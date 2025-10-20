import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { FileTable } from "./components/files/FileTable";
import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewAutoConvertBanner } from "./components/OverviewAutoConvertBanner";
import { RemoveFileDialog } from "./components/dialogs/RemoveFileDialog";
import { RebuildFileDialog } from "./components/dialogs/RebuildFileDialog";
import { FileProcessingOverlay } from "./components/FileProcessingOverlay";
import { useToast } from "@/shared/ui/use-toast";

import {
  addFilesToProject,
  convertStream,
  convertXliffToJliff,
  ensureProjectConversionsPlan,
  getAppSettings,
  getProjectDetails,
  removeProjectFile,
  updateConversionStatus,
  validateStream,
  type EnsureConversionsPlan,
  type EnsureConversionsTask,
  type JliffConversionResult,
  type ProjectDetails,
  type ProjectListItem,
} from "@/core/ipc";
import { PROJECT_FILE_DIALOG_FILTERS } from "@/modules/projects/config";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useAuth } from "@/app/providers";

type Props = {
  projectSummary: ProjectListItem;
};

const DEFAULT_PROCESS_MESSAGES = [
  "Importing files…",
  "Scanning translation segments…",
  "Preparing conversion plan…",
  "Validating bilingual assets…",
  "Handing off to converter…",
] as const;

type ProcessingState = {
  active: boolean;
  step: number;
  fileCount: number;
};

const firstMeaningfulLine = (value?: string | null) =>
  value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

export function ProjectOverview({ projectSummary }: Props) {
  const projectId = projectSummary.projectId;
  const { user } = useAuth();
  const { toast } = useToast();
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRemoveOpen, setIsRemoveOpen] = useState<null | string>(null);
  const [rebuildTarget, setRebuildTarget] = useState<{ fileId: string; name: string } | null>(null);
  const [rebuildingFileId, setRebuildingFileId] = useState<string | null>(null);
  const [processingMessages, setProcessingMessages] = useState<readonly string[]>(DEFAULT_PROCESS_MESSAGES);
  const [autoConvertOnOpen, setAutoConvertOnOpen] = useState<boolean>(true);
  const initialEnsureDone = useRef(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({ active: false, step: 0, fileCount: 0 });
  const finishProcessingTimer = useRef<number | null>(null);

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
  const relativeToProject = useCallback(
    (absPath: string) => {
      const root = details?.rootPath ?? "";
      if (!absPath.startsWith(root)) return absPath;
      const trimmed = absPath.slice(root.length);
      return trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    },
    [details?.rootPath],
  );

  const beginProcessing = useCallback((fileCount: number) => {
    if (fileCount <= 0) {
      return false;
    }
    if (finishProcessingTimer.current) {
      window.clearTimeout(finishProcessingTimer.current);
      finishProcessingTimer.current = null;
    }
    setProcessingMessages(DEFAULT_PROCESS_MESSAGES);
    setProcessingState({ active: true, step: 0, fileCount });
    return true;
  }, []);

  const advanceProcessing = useCallback((targetStep: number) => {
    setProcessingState((prev) => {
      if (!prev.active) return prev;
      const maxStep = processingMessages.length - 1;
      const nextStep = Math.min(Math.max(prev.step, targetStep), maxStep);
      if (nextStep === prev.step) return prev;
      return { ...prev, step: nextStep };
    });
  }, [processingMessages.length]);

  const finishProcessing = useCallback(() => {
    setProcessingState((prev) => {
      if (!prev.active) return prev;
      const maxStep = processingMessages.length - 1;
      return { ...prev, step: maxStep };
    });
    if (finishProcessingTimer.current) {
      window.clearTimeout(finishProcessingTimer.current);
    }
    finishProcessingTimer.current = window.setTimeout(() => {
      setProcessingState({ active: false, step: 0, fileCount: 0 });
      setProcessingMessages(DEFAULT_PROCESS_MESSAGES);
      finishProcessingTimer.current = null;
    }, 600);
  }, [processingMessages.length]);

  const processTask = useCallback(async (task: EnsureConversionsTask) => {
    const onStdout = (line: string) => {
      if (line.trim().length > 0) {
        console.debug("[convert stdout]", line);
      }
    };
    const onStderr = (line: string) => {
      if (line.trim().length > 0) {
        console.warn("[convert stderr]", line);
      }
    };

    try {
      await updateConversionStatus(task.conversionId, "running");

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
        await updateConversionStatus(task.conversionId, "failed", { errorMessage: detail });
        return { ok: false as const, error: detail };
      }

      const val = await validateStream({ xliff: task.outputAbsPath }, { onStdout, onStderr });
      if (!val.ok) {
        const detail = val.knownError?.detail || val.message || `Validation failed (code ${val.code ?? "?"}).`;
        await updateConversionStatus(task.conversionId, "failed", { errorMessage: detail });
        return { ok: false as const, error: detail };
      }

      const validationSummary = {
        validator: "xliff_schema",
        passed: true,
        skipped: false,
        message:
          val.message ||
          firstMeaningfulLine(val.stdout) ||
          firstMeaningfulLine(val.stderr),
      };

      let jliffResult: JliffConversionResult;
      try {
        jliffResult = await convertXliffToJliff({
          projectId,
          conversionId: task.conversionId,
          xliffAbsPath: task.outputAbsPath,
          operator: user?.name || user?.email || undefined,
        });
      } catch (jliffError) {
        const message = jliffError instanceof Error ? jliffError.message : "JLIFF conversion failed";
        await updateConversionStatus(task.conversionId, "failed", { errorMessage: message });
        return { ok: false as const, error: message };
      }

      const rel = relativeToProject(task.outputAbsPath);
      await updateConversionStatus(task.conversionId, "completed", {
        xliffRelPath: rel,
        jliffRelPath: jliffResult.jliffRelPath,
        tagMapRelPath: jliffResult.tagMapRelPath,
        validation: validationSummary,
      });
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion error";
      await updateConversionStatus(task.conversionId, "failed", { errorMessage: msg });
      return { ok: false as const, error: msg };
    }
  }, [projectId, relativeToProject, user]);

  const runConversionPlan = useCallback(async (
    plan: EnsureConversionsPlan,
    options: { silent?: boolean } = {},
  ) => {
    const { silent = false } = options;
    if (plan.tasks.length === 0) {
      return { completed: 0, failed: 0, errors: [] as string[] };
    }

    const total = plan.tasks.length;
    const errors: string[] = [];
    let messagesForRun: string[] | null = null;
    let conversionStartIndex = 0;

    if (!silent) {
      messagesForRun = [
        ...DEFAULT_PROCESS_MESSAGES.slice(0, 4),
        ...plan.tasks.map((_, index) => `Converting file ${index + 1} of ${total}…`),
        "Finalizing conversion artifacts…",
      ];
      conversionStartIndex = messagesForRun.length - (total + 1);
      const startStep = Math.max(0, conversionStartIndex - 1);
      setProcessingMessages(messagesForRun);
      setProcessingState((prev) => {
        if (!prev.active) {
          return { active: true, step: startStep, fileCount: total };
        }
        const nextStep = Math.max(prev.step, startStep);
        if (prev.step === nextStep && prev.fileCount === total) {
          return prev;
        }
        return { ...prev, step: nextStep, fileCount: total };
      });
    }

    let completed = 0;
    let failed = 0;

    try {
      for (let index = 0; index < plan.tasks.length; index++) {
        if (!silent && messagesForRun) {
          const targetStep = conversionStartIndex + index;
          setProcessingState((prev) => {
            if (!prev.active) {
              return { active: true, step: targetStep, fileCount: total };
            }
            if (prev.step >= targetStep && prev.fileCount === total) {
              return prev;
            }
            return { ...prev, step: Math.max(prev.step, targetStep), fileCount: total };
          });
        }

        const result = await processTask(plan.tasks[index]);
        if (result.ok) {
          completed += 1;
        } else {
          failed += 1;
          if (result.error) {
            errors.push(result.error);
          }
        }
      }
    } finally {
      if (!silent) {
        setProcessingState((prev) => (prev.active ? { ...prev, fileCount: total } : prev));
        finishProcessing();
      }
    }

    return { completed, failed, errors };
  }, [finishProcessing, processTask]);

  const importAndQueueFiles = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) {
      return;
    }

    setError(null);
    const started = beginProcessing(filePaths.length);
    if (!started) {
      return;
    }

    let conversionsTriggered = false;
    try {
      await addFilesToProject(projectId, filePaths);
      advanceProcessing(1);

      await loadDetails();
      advanceProcessing(2);

      const plan = await ensureProjectConversionsPlan(projectId);
      advanceProcessing(3);

      if (plan.integrityAlerts.length > 0) {
        const alertNames = plan.integrityAlerts.map((alert) => alert.fileName);
        const displayNames = alertNames.slice(0, 3).join(", ");
        const remaining = alertNames.length - 3;
        const description = remaining > 0
          ? `${displayNames} and ${remaining} other${remaining === 1 ? "" : "s"} no longer match their stored checksums.`
          : `${displayNames} no longer ${alertNames.length === 1 ? "matches" : "match"} the stored checksum.`;
        toast({
          variant: "destructive",
          title: "File integrity mismatch",
          description,
        });
      }

      if (plan.tasks.length > 0) {
        conversionsTriggered = true;
        const summary = await runConversionPlan(plan);
        await loadDetails();
        if (summary.failed > 0) {
          setError("Some conversions failed. Check the file list for details.");
          toast({
            variant: "destructive",
            title: "Conversion issues",
            description: `${summary.failed} file${summary.failed === 1 ? "" : "s"} failed to convert.`,
          });
        } else {
          toast({
            title: "Files converted",
            description: `${summary.completed} file${summary.completed === 1 ? "" : "s"} ready for editing.`,
          });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to add files.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Add files failed",
        description: message,
      });
    } finally {
      if (!conversionsTriggered) {
        finishProcessing();
      }
    }
  }, [advanceProcessing, beginProcessing, finishProcessing, loadDetails, projectId, runConversionPlan, toast]);

  const handleFilesDropped = useCallback((files: string[]) => {
    if (processingState.active) return;
    void importAndQueueFiles(files);
  }, [importAndQueueFiles, processingState.active]);

  const handleConfirmAddFiles = useCallback(async () => {
    if (processingState.active) return;

    try {
      const selection = await openDialog({
        multiple: true,
        title: "Select files to add to project",
        filters: PROJECT_FILE_DIALOG_FILTERS.map((filter) => ({
          name: filter.name,
          extensions: [...filter.extensions],
        })),
      });
      const files = Array.isArray(selection) ? selection : selection ? [selection] : [];
      if (files.length > 0) {
        await importAndQueueFiles(files);
      }
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) {
        setError(e instanceof Error ? e.message : "Failed to add files.");
      }
    }
  }, [importAndQueueFiles, processingState.active, setError]);

  const handleAddFilesRequest = useCallback(() => {
    void handleConfirmAddFiles();
  }, [handleConfirmAddFiles]);

  useEffect(() => {
    if (!processingState.active) return;
    const maxStep = processingMessages.length - 1;
    if (processingState.step >= maxStep) return;

    const timer = window.setTimeout(() => {
      setProcessingState((prev) => {
        if (!prev.active) return prev;
        const localMax = processingMessages.length - 1;
        const nextStep = Math.min(prev.step + 1, localMax);
        if (nextStep === prev.step) return prev;
        return { ...prev, step: nextStep };
      });
    }, 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [processingMessages.length, processingState.active, processingState.step]);

  useEffect(() => () => {
    if (finishProcessingTimer.current) {
      window.clearTimeout(finishProcessingTimer.current);
    }
  }, []);

  const handleRemoveFile = useCallback(async () => {
    const id = isRemoveOpen;
    if (!id) return;
    try {
      await removeProjectFile(projectId, id);
      await loadDetails();
      toast({
        title: "File removed",
        description: "The file and its related artifacts were deleted.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to remove file.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Remove failed",
        description: message,
      });
    } finally {
      setIsRemoveOpen(null);
    }
  }, [isRemoveOpen, loadDetails, projectId, toast]);


  // Auto-ensure conversions on first load
  useEffect(() => {
    if (!details || !autoConvertOnOpen || initialEnsureDone.current) return;
    initialEnsureDone.current = true;
    void (async () => {
      try {
        const plan = await ensureProjectConversionsPlan(details.id);
        if (plan.tasks.length === 0) {
          return;
        }
        const summary = await runConversionPlan(plan, { silent: true });
        if (summary.failed > 0) {
          setError("Some files failed to convert automatically. Check the file list for more details.");
        }
        await loadDetails();
      } catch {
        // non-blocking
      }
    })();
  }, [autoConvertOnOpen, details, loadDetails, runConversionPlan]);

  const anyFailures = useMemo(() => {
    if (!details) return false;
    return details.files.some((f) => f.conversions.some((c) => c.status === "failed"));
  }, [details]);

  const retryFailed = useCallback(async () => {
    if (!details || processingState.active) return;

    let started = false;
    let conversionsTriggered = false;

    try {
      for (const entry of details.files) {
        for (const conv of entry.conversions) {
          if (conv.status === "failed") {
            await updateConversionStatus(conv.id, "pending");
          }
        }
      }

      await loadDetails();
      const plan = await ensureProjectConversionsPlan(details.id);
      if (plan.tasks.length === 0) {
        toast({
          title: "All clear",
          description: "No failed conversions were found.",
        });
        return;
      }

      started = beginProcessing(plan.tasks.length);
      if (!started) {
        return;
      }
      advanceProcessing(3);
      conversionsTriggered = true;

      const summary = await runConversionPlan(plan);
      await loadDetails();
      if (summary.failed > 0) {
        setError("Some files still failed during retry. Please review the file list.");
        toast({
          variant: "destructive",
          title: "Retry completed with issues",
          description: `${summary.failed} file${summary.failed === 1 ? "" : "s"} still failing.`,
        });
      } else {
        toast({
          title: "Retry successful",
          description: `${summary.completed} file${summary.completed === 1 ? "" : "s"} converted successfully.`,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to retry conversions.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Retry failed",
        description: message,
      });
    } finally {
      if (started && !conversionsTriggered) {
        finishProcessing();
      }
    }
  }, [advanceProcessing, beginProcessing, details, finishProcessing, loadDetails, processingState.active, runConversionPlan, toast]);

  const handleRequestRemove = useCallback((fileId: string) => {
    setIsRemoveOpen(fileId);
  }, [setIsRemoveOpen]);

  const handleRequestRebuild = useCallback(
    (fileId: string) => {
      if (!details) return;
      const entry = details.files.find((file) => file.file.id === fileId);
      if (!entry) return;
      setRebuildTarget({ fileId, name: entry.file.originalName });
    },
    [details],
  );

  const handleConfirmRebuild = useCallback(async () => {
    if (!details || !rebuildTarget || processingState.active) return;
    const target = rebuildTarget;
    const entry = details.files.find((file) => file.file.id === target.fileId);
    const conversions = entry?.conversions ?? [];
    setRebuildTarget(null);
    if (conversions.length === 0) {
      toast({
        title: "Nothing to rebuild",
        description: "This file has no conversions yet.",
      });
      return;
    }

    setRebuildingFileId(target.fileId);
    setError(null);

    let started = false;
    let conversionsTriggered = false;

    try {
      for (const conversion of conversions) {
        await updateConversionStatus(conversion.id, "pending");
      }

      const plan = await ensureProjectConversionsPlan(details.id);
      const fileTasks = plan.tasks.filter((task) => task.projectFileId === target.fileId);
      if (fileTasks.length === 0) {
        toast({
          title: "Already up to date",
          description: "All conversions for this file are current.",
        });
        return;
      }

      started = beginProcessing(fileTasks.length);
      if (!started) {
        return;
      }
      advanceProcessing(3);
      conversionsTriggered = true;

      const summary = await runConversionPlan({ ...plan, tasks: fileTasks });
      await loadDetails();

      if (summary.failed > 0) {
        setError(`Rebuild completed with ${summary.failed} failure${summary.failed === 1 ? "" : "s"}.`);
        toast({
          variant: "destructive",
          title: "Rebuild issues",
          description: `${summary.failed} conversion${summary.failed === 1 ? "" : "s"} failed.`,
        });
      } else {
        toast({
          title: "Rebuild successful",
          description: `${summary.completed} conversion${summary.completed === 1 ? "" : "s"} refreshed.`,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to rebuild file.";
      setError(message);
      await loadDetails();
      toast({
        variant: "destructive",
        title: "Rebuild failed",
        description: message,
      });
    } finally {
      if (started && !conversionsTriggered) {
        finishProcessing();
      }
      setRebuildingFileId(null);
    }
  }, [advanceProcessing, beginProcessing, details, finishProcessing, loadDetails, processingState.active, rebuildTarget, runConversionPlan, toast]);

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

  const showAutoConvertBanner = !autoConvertOnOpen;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-4">
        <OverviewHeader
          project={projectSummary}
          details={details}
          autoConvertOnOpen={autoConvertOnOpen}
        />

        {showAutoConvertBanner ? (
          <div className="mx-4">
            <OverviewAutoConvertBanner autoConvertOnOpen={autoConvertOnOpen} />
          </div>
        ) : null}

        {error ? (
          <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>

      {/* Languages card removed in favor of compact header */}

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        <div className="mx-4 flex min-h-0 flex-1 justify-center">
          <Card className="flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-background/80 py-0 shadow-sm">
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-6">
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <FileTable
                  files={details?.files ?? []}
                  isLoading={isLoading}
                  onRemove={handleRequestRemove}
                  onOpenEditor={handleOpenEditor}
                  onRebuild={handleRequestRebuild}
                  onAddFiles={handleAddFilesRequest}
                  onFilesDropped={handleFilesDropped}
                  rebuildingFileId={rebuildingFileId}
                  isProcessing={processingState.active}
                />
                <FileProcessingOverlay
                  visible={processingState.active}
                  messages={processingMessages}
                  currentStep={processingState.step}
                  fileCount={processingState.fileCount}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {anyFailures ? (
          <div className="mx-4 flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <div>Some conversions failed. You can retry after fixing the source content.</div>
            <Button variant="outline" size="sm" onClick={() => void retryFailed()}>
              Retry failed
            </Button>
          </div>
        ) : null}
      </div>

      <RemoveFileDialog
        open={isRemoveOpen !== null}
        onOpenChange={(open) => setIsRemoveOpen(open ? isRemoveOpen : null)}
        onConfirm={() => void handleRemoveFile()}
      />

      <RebuildFileDialog
        open={rebuildTarget !== null}
        onOpenChange={(open) => setRebuildTarget((prev) => (open ? prev : null))}
        onConfirm={() => void handleConfirmRebuild()}
        isBusy={processingState.active || (rebuildTarget ? rebuildingFileId === rebuildTarget.fileId : false)}
        fileName={rebuildTarget?.name}
      />

    </section>
  );
}

// formatSize and import status styles now live in FileListItem
