import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

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
      const fileExt = task.inputAbsPath.split(".").pop()?.toLowerCase();
      const knownTypes = new Set([
        "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "html", "xml", "dita", "md",
      ] as const);
      const convType = fileExt && knownTypes.has(fileExt as any) ? (fileExt as string) : undefined;
      setLogs((cur) => [
        ...cur,
        `> convert -file ${task.inputAbsPath} -srcLang ${task.srcLang} -tgtLang ${task.tgtLang} -xliff ${task.outputAbsPath} ${convType ? `-type ${convType} ` : ""}-${task.version}`,
      ]);
      const res = await convertStream({
        file: task.inputAbsPath,
        srcLang: task.srcLang,
        tgtLang: task.tgtLang,
        xliff: task.outputAbsPath,
        version: task.version as "2.0" | "2.1" | "2.2",
        type: convType,
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

  return (
    <section className="flex w-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project</p>
          <h2 className="text-2xl font-semibold text-foreground">{projectSummary.name}</h2>
          <p className="text-sm text-muted-foreground">{projectSummary.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            title={
              !autoConvertOnOpen
                ? "Auto-conversion is disabled; conversions won’t start automatically"
                : undefined
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add files
          </Button>
        </div>
      </div>

      {!autoConvertOnOpen ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
          <div>
            Auto-convert on open is disabled. Conversions will not start automatically.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate to settings via global app event
              window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "settings" } }));
            }}
          >
            Open settings
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-border/60 border-b pb-4">
          <CardTitle className="text-base font-semibold">Languages</CardTitle>
          <CardDescription>Default conversion pair for this project.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</p>
              <p className="text-sm font-medium text-foreground">{defaultSrc}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Target</p>
              <p className="text-sm font-medium text-foreground">{defaultTgt}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-border/60 border-b pb-4">
          <CardTitle className="text-base font-semibold">Files</CardTitle>
          <CardDescription>Imported files and conversion status.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">File</TableHead>
                <TableHead>Ext</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[40%]">Conversions</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="pl-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  </TableCell>
                </TableRow>
              ) : details && details.files.length > 0 ? (
                details.files.map((row) => (
                  <TableRow key={row.file.id}>
                    <TableCell className="pl-6 font-medium">{row.file.originalName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.file.ext}</TableCell>
                    <TableCell className="text-muted-foreground">{formatSize(row.file.sizeBytes)}</TableCell>
                    <TableCell>{formatImportStatus(row.file.importStatus)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.conversions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          row.conversions.map((c) => (
                            <StatusBadge key={c.id} conversion={c} />
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button size="icon" variant="ghost" onClick={() => setIsRemoveOpen(row.file.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="pl-6 text-sm text-muted-foreground">
                    No files yet. Use "Add files" to import.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {anyFailures ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <div>Some conversions failed. You can retry after fixing the source content.</div>
          <Button variant="outline" size="sm" onClick={retryFailed}>Retry failed</Button>
        </div>
      ) : null}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add files</DialogTitle>
            <DialogDescription>Select files to import into this project.</DialogDescription>
          </DialogHeader>
          <Separator className="my-2" />
          <div className="text-sm text-muted-foreground">You will be prompted to select files using the system dialog.</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFiles}>Choose files…</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRemoveOpen !== null} onOpenChange={(open) => setIsRemoveOpen(open ? isRemoveOpen : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove file</DialogTitle>
            <DialogDescription>This will remove the file from the project. Converted artifacts will also be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRemoveOpen(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveFile}>
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ensurePlan} onOpenChange={(open) => (!open ? setEnsurePlan(null) : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preparing project…</DialogTitle>
            <DialogDescription>Converting files to XLIFF and validating outputs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <ProgressBar current={ensureProgress.current} total={ensureProgress.total} running={isEnsuring} />
            {queueSummary ? (
              <div className="text-xs text-muted-foreground">
                Completed: {queueSummary.completed} • Failed: {queueSummary.failed}
              </div>
            ) : null}
            <div className="h-48 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
              {logs.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap text-muted-foreground">
                  {line}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            {isEnsuring ? (
              <Button variant="outline" onClick={cancelEnsureQueue}>Cancel</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setEnsurePlan(null)}>Close</Button>
                {!queueSummary ? (
                  <Button onClick={startEnsureQueue}>
                    <Loader2 className="mr-2 h-4 w-4" /> Start
                  </Button>
                ) : null}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusBadge({ conversion }: { conversion: ProjectFileConversionDto }) {
  const color =
    conversion.status === "completed"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : conversion.status === "running"
      ? "bg-primary/10 text-primary"
      : conversion.status === "failed"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";
  const label = `${conversion.srcLang}→${conversion.tgtLang} (${conversion.version}) — ${conversion.status}`;
  return <span className={`inline-flex rounded px-2 py-0.5 text-[0.7rem] ${color}`}>{label}</span>;
}

function ProgressBar({ current, total, running }: { current: number; total: number; running: boolean }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">
        {running ? `${current} / ${total}` : total > 0 ? `0 / ${total}` : ""}
      </div>
    </div>
  );
}

function formatSize(size?: number) {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 10.24) / 100} KB`;
  return `${Math.round(size / 10485.76) / 100} MB`;
}

function formatImportStatus(status: string) {
  if (status === "imported") return <span className="inline-flex rounded bg-emerald-500/15 px-2 py-0.5 text-[0.7rem] text-emerald-700 dark:text-emerald-300">imported</span>;
  if (status === "failed") return <span className="inline-flex rounded bg-destructive/10 px-2 py-0.5 text-[0.7rem] text-destructive">failed</span>;
  return <span className="inline-flex rounded bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">{status}</span>;
}
