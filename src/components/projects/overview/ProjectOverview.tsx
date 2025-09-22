import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileList } from "./components/files/FileList";
import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewAutoConvertBanner } from "./components/OverviewAutoConvertBanner";
import { AddFilesDialog } from "./components/dialogs/AddFilesDialog";
import { RemoveFileDialog } from "./components/dialogs/RemoveFileDialog";
import { EnsureQueueModal } from "./components/EnsureQueueModal";

import {
  addFilesToProject,
  ensureProjectConversionsPlan,
  getProjectDetails,
  removeProjectFile,
  updateConversionStatus,
  type EnsureConversionsPlan,
  type EnsureConversionsTask,
  type ProjectDetails,
  type ProjectFileConversionDto,
  type ProjectListItem,
} from "@/ipc";
import { convertStream, validateStream } from "@/lib/openxliff";
import { getAppSettings } from "@/ipc";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

type Props = {
  projectSummary: ProjectListItem;
};

export function ProjectOverview({ projectSummary }: Props) {
  const projectId = projectSummary.projectId;
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState<null | string>(null);

  // Conversion queue modal state
  const [ensurePlan, setEnsurePlan] = useState<EnsureConversionsPlan | null>(null);
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [ensureProgress, setEnsureProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const cancelRequested = useRef(false);
  const [autoConvertOnOpen, setAutoConvertOnOpen] = useState<boolean>(true);
  const initialEnsureDone = useRef(false);
  const [queueSummary, setQueueSummary] = useState<{ completed: number; failed: number } | null>(null);

  const defaultSrc = details?.defaultSrcLang ?? "en-US";
  const defaultTgt = details?.defaultTgtLang ?? "it-IT";

  const loadDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectDetails(projectId);
      setDetails(data);
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : "Failed to load project details.";
      setError(message);
      if (/not found|missing required key|invalid args/i.test(message)) {
        // Navigate back to projects when the project cannot be loaded
        window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "projects" } }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      void loadDetails();
      try {
        const settings = await getAppSettings();
        setAutoConvertOnOpen(settings.autoConvertOnOpen ?? true);
      } catch {
        setAutoConvertOnOpen(true);
      }
    })();
  }, [loadDetails]);

  // Auto-ensure conversions on first load
  useEffect(() => {
    if (!details || !autoConvertOnOpen || initialEnsureDone.current) return;
    initialEnsureDone.current = true;
    void (async () => {
      try {
        const plan = await ensureProjectConversionsPlan(details.id);
        if (plan.tasks.length > 0) {
          setEnsurePlan(plan);
          setEnsureProgress({ current: 0, total: plan.tasks.length });
        }
      } catch {
        // non-blocking
      }
    })();
  }, [details, autoConvertOnOpen]);

  // (moved below to avoid TS use-before-assign)

  const relativeToProject = useCallback(
    (absPath: string) => {
      const root = details?.rootPath ?? "";
      if (!absPath.startsWith(root)) return absPath;
      const trimmed = absPath.slice(root.length);
      return trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    },
    [details?.rootPath],
  );

  const handleAddFiles = useCallback(async () => {
    try {
      const selected = await openDialog({ multiple: true });
      const files = Array.isArray(selected) ? selected : selected ? [selected] : [];
      if (files.length === 0) return;
      await addFilesToProject(projectId, files);
      await loadDetails();
      // re-check conversions after adding
      const plan = await ensureProjectConversionsPlan(projectId);
      if (plan.tasks.length > 0) {
        setEnsurePlan(plan);
        setEnsureProgress({ current: 0, total: plan.tasks.length });
      }
    } catch (e) {
      // surface UI error via banner
      setError(e instanceof Error ? e.message : "Failed to add files.");
    } finally {
      setIsAddOpen(false);
    }
  }, [loadDetails, projectId]);

  const handleRemoveFile = useCallback(async () => {
    const id = isRemoveOpen;
    if (!id) return;
    try {
      await removeProjectFile(projectId, id);
      await loadDetails();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove file.");
    } finally {
      setIsRemoveOpen(null);
    }
  }, [isRemoveOpen, loadDetails, projectId]);

  const startEnsureQueue = useCallback(async () => {
    if (!ensurePlan || ensurePlan.tasks.length === 0) return;
    setIsEnsuring(true);
    cancelRequested.current = false;
    setLogs([]);
    setEnsureProgress({ current: 0, total: ensurePlan.tasks.length });
    setQueueSummary(null);

    // No preflight: call convert directly and surface its stderr/stdout.
    let failed = 0;
    let completed = 0;
    for (let i = 0; i < ensurePlan.tasks.length; i++) {
      if (cancelRequested.current) break;
      const task = ensurePlan.tasks[i];
      setEnsureProgress({ current: i, total: ensurePlan.tasks.length });
      const ok = await processTask(task);
      if (ok) completed += 1;
      else failed += 1;
    }

    setIsEnsuring(false);
    setEnsureProgress({ current: 0, total: 0 });
    setQueueSummary({ completed, failed });
    await loadDetails();
    if (failed === 0) {
      // Auto-close only on full success
      setEnsurePlan(null);
    }
  }, [ensurePlan, loadDetails]);

  const processTask = useCallback(async (task: EnsureConversionsTask) => {
    const onStdout = (line: string) => setLogs((cur) => [...cur, line]);
    const onStderr = (line: string) => setLogs((cur) => [...cur, line]);
    try {
      await updateConversionStatus(task.conversionId, "running");
      const showVersion = /^2\./.test(task.version) ? ` -${task.version}` : '';
      setLogs((cur) => [
        ...cur,
        `> convert -file ${task.inputAbsPath} -srcLang ${task.srcLang} -tgtLang ${task.tgtLang} -xliff ${task.outputAbsPath}${showVersion}`,
      ]);
      const res = await convertStream({
        file: task.inputAbsPath,
        srcLang: task.srcLang,
        tgtLang: task.tgtLang,
        xliff: task.outputAbsPath,
        version: /^2\./.test(task.version) ? (task.version as "2.0" | "2.1" | "2.2") : undefined,
        paragraph: task.paragraph,
        embed: task.embed,
      }, { onStdout, onStderr });

      if (!res.ok) {
        const detail = res.knownError?.detail || res.message || `Conversion failed (code ${res.code ?? "?"}).`;
        setLogs((cur) => {
          const lines: string[] = [];
          lines.push(`Exit code: ${res.code ?? "?"}`);
          const stderrLines = (res.stderr || "").split(/\r?\n/).filter(Boolean);
          const stdoutLines = (res.stdout || "").split(/\r?\n/).filter(Boolean);
          if (stderrLines.length) {
            lines.push("--- stderr (tail) ---");
            lines.push(...stderrLines.slice(-10));
          }
          if (stdoutLines.length) {
            lines.push("--- stdout (tail) ---");
            lines.push(...stdoutLines.slice(-10));
          }
          lines.push(`ERROR: ${detail}`);
          return [...cur, ...lines];
        });
        await updateConversionStatus(task.conversionId, "failed", { errorMessage: detail });
        return false;
      }

      const val = await validateStream({ xliff: task.outputAbsPath }, { onStdout, onStderr });
      if (!val.ok) {
        const detail = val.knownError?.detail || val.message || `Validation failed (code ${val.code ?? "?"}).`;
        setLogs((cur) => {
          const lines: string[] = [];
          lines.push(`Exit code: ${val.code ?? "?"}`);
          const stderrLines = (val.stderr || "").split(/\r?\n/).filter(Boolean);
          const stdoutLines = (val.stdout || "").split(/\r?\n/).filter(Boolean);
          if (stderrLines.length) {
            lines.push("--- stderr (tail) ---");
            lines.push(...stderrLines.slice(-10));
          }
          if (stdoutLines.length) {
            lines.push("--- stdout (tail) ---");
            lines.push(...stdoutLines.slice(-10));
          }
          lines.push(`ERROR: ${detail}`);
          return [...cur, ...lines];
        });
        await updateConversionStatus(task.conversionId, "failed", { errorMessage: detail });
        return false;
      }

      const rel = relativeToProject(task.outputAbsPath);
      await updateConversionStatus(task.conversionId, "completed", { xliffRelPath: rel });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion error";
      setLogs((cur) => [...cur, `ERROR: ${msg}`]);
      await updateConversionStatus(task.conversionId, "failed", { errorMessage: msg });
      return false;
    }
  }, [relativeToProject]);

  const cancelEnsureQueue = useCallback(() => {
    cancelRequested.current = true;
  }, []);

  // Auto-start queue once plan is ready (after callbacks are defined)
  useEffect(() => {
    // Auto-start only when a new plan arrives and no summary exists yet
    if (!ensurePlan || isEnsuring || queueSummary) return;
    void startEnsureQueue();
  }, [ensurePlan, isEnsuring, queueSummary, startEnsureQueue]);

  const anyFailures = useMemo(() => {
    if (!details) return false;
    return details.files.some((f) => f.conversions.some((c) => c.status === "failed"));
  }, [details]);

  const retryFailed = useCallback(async () => {
    if (!details) return;
    try {
      // Mark all failed conversions as pending
      for (const entry of details.files) {
        for (const conv of entry.conversions) {
          if (conv.status === "failed") {
            await updateConversionStatus(conv.id, "pending");
          }
        }
      }
      // Refresh and ensure plan again
      await loadDetails();
      const plan = await ensureProjectConversionsPlan(details.id);
      if (plan.tasks.length > 0) {
        setEnsurePlan(plan);
        setEnsureProgress({ current: 0, total: plan.tasks.length });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to retry conversions.");
    }
  }, [details, loadDetails]);

  const handleRequestRemove = useCallback((fileId: string) => {
    setIsRemoveOpen(fileId);
  }, [setIsRemoveOpen]);

  const handleOpenEditor = useCallback(
    (fileId: string) => {
      window.dispatchEvent(
        new CustomEvent("app:navigate", {
          detail: { view: "editor", projectId, fileId },
        }),
      );
    },
    [projectId],
  );

  return (
    <section className="flex w-full flex-col gap-6 overflow-y-auto p-6">
      <OverviewHeader
        project={projectSummary}
        details={details}
        onAddFiles={() => setIsAddOpen(true)}
        autoConvertOnOpen={autoConvertOnOpen}
      />

      <OverviewAutoConvertBanner autoConvertOnOpen={autoConvertOnOpen} />

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Languages card removed in favor of compact header */}

      <Card>
        <CardHeader className="border-border/60 border-b pb-4">
          <CardTitle className="text-base font-semibold">Files</CardTitle>
          <CardDescription>Imported files and conversion status.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <FileList
            files={details?.files ?? []}
            isLoading={isLoading}
            onRemove={handleRequestRemove}
            onOpenEditor={handleOpenEditor}
          />
        </CardContent>
      </Card>

      {anyFailures ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <div>Some conversions failed. You can retry after fixing the source content.</div>
          <Button variant="outline" size="sm" onClick={retryFailed}>Retry failed</Button>
        </div>
      ) : null}

      <AddFilesDialog open={isAddOpen} onOpenChange={setIsAddOpen} onConfirm={handleAddFiles} />

      <RemoveFileDialog
        open={isRemoveOpen !== null}
        onOpenChange={(open) => setIsRemoveOpen(open ? isRemoveOpen : null)}
        onConfirm={handleRemoveFile}
      />

      <EnsureQueueModal
        plan={ensurePlan}
        isEnsuring={isEnsuring}
        progress={ensureProgress}
        logs={logs}
        summary={queueSummary}
        onClose={() => setEnsurePlan(null)}
        onStart={startEnsureQueue}
        onCancel={cancelEnsureQueue}
      />
    </section>
  );
}

// formatSize and import status styles now live in FileListItem
