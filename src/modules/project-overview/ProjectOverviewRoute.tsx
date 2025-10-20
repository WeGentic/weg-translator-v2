import { useCallback, useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { useToast } from "@/shared/ui/use-toast";
import type { ProjectListItem } from "@/core/ipc";
import {
  addFilesToProject,
  getProjectBundle,
  removeProjectFile,
  updateProjectFileRole,
  ensureProjectConversionsPlan,
  updateConversionStatus,
  convertXliffToJliff,
  convertStream,
  validateStream,
  getProjectStatistics,
} from "@/core/ipc";
import type { ProjectBundle, ProjectRecord } from "@/shared/types/database";
import type { ProjectFileRoleValue } from "@/types/project-files";
import { PROJECT_FILE_DIALOG_FILTERS } from "@/modules/projects/config";

import {
  ProjectOverviewProvider,
  useProjectOverviewContext,
  type ProjectOverviewContextValue,
} from "./routes/project-overview-context";
import { ProjectOverviewPage } from "./views/ProjectOverviewPage";

export type ProjectOverviewRouteProps = ProjectOverviewContextValue;

export function ProjectOverviewRoute(initialProps: ProjectOverviewRouteProps) {
  const projectId = initialProps.projectId;
  const [summary, setSummary] = useState(initialProps.summary);
  const [bundle, setBundle] = useState(initialProps.bundle);
  const [statistics, setStatistics] = useState(initialProps.statistics ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSummary(initialProps.summary);
    setBundle(initialProps.bundle);
    setStatistics(initialProps.statistics ?? null);
  }, [initialProps.summary, initialProps.bundle, initialProps.statistics]);

  const refreshProjectData = useCallback(async () => {
    const [nextBundle, nextStats] = await Promise.all([
      getProjectBundle(projectId),
      getProjectStatistics(projectId).catch((error) => {
        console.warn("[project-overview] failed to refresh statistics", error);
        return null;
      }),
    ]);

    if (nextBundle) {
      setBundle(nextBundle);
      setSummary((prev) => {
        const updatedSummary = mapProjectRecordToListItem(nextBundle.project, nextBundle);
        return prev ? { ...prev, ...updatedSummary } : updatedSummary;
      });
    }

    setStatistics(nextStats ?? null);
  }, [projectId]);

  const handleAddFiles = useCallback(async () => {
    try {
      const selection = await openDialog({
        multiple: true,
        title: "Select files to add",
        filters: PROJECT_FILE_DIALOG_FILTERS.map((filter) => ({
          name: filter.name,
          extensions: [...filter.extensions],
        })),
      });
      const paths = Array.isArray(selection) ? selection : selection ? [selection] : [];
      if (paths.length === 0) {
        return;
      }

      setIsBusy(true);
      await addFilesToProject(projectId, paths);
      await refreshProjectData();
      toast({
        title: "Files added",
        description: `${paths.length} file${paths.length === 1 ? "" : "s"} queued for processing.`,
      });
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) {
        return;
      }
      const description = error instanceof Error ? error.message : "Unable to add files.";
      toast({ variant: "destructive", title: "Add files failed", description });
    } finally {
      setIsBusy(false);
    }
  }, [projectId, refreshProjectData, toast]);

  const handleRemoveFile = useCallback(
    async (fileUuid: string) => {
      try {
        setIsBusy(true);
        await removeProjectFile(projectId, fileUuid);
        await refreshProjectData();
        toast({ title: "File removed", description: "The file was removed from the project." });
      } catch (error) {
        const description = error instanceof Error ? error.message : "Unable to remove file.";
        toast({ variant: "destructive", title: "Remove failed", description });
      } finally {
        setIsBusy(false);
      }
    },
    [projectId, refreshProjectData, toast],
  );

  const handleChangeRole = useCallback(
    async (fileUuid: string, nextRole: ProjectFileRoleValue) => {
      try {
        setIsBusy(true);
        await updateProjectFileRole(projectId, fileUuid, nextRole);
        await refreshProjectData();
        toast({
          title: "File role updated",
          description: "Changes saved for the selected file.",
        });
      } catch (error) {
        const description = error instanceof Error ? error.message : "Unable to update file role.";
        toast({ variant: "destructive", title: "Role update failed", description });
      } finally {
        setIsBusy(false);
      }
    },
    [projectId, refreshProjectData, toast],
  );

  const runRegeneration = useCallback(
    async (fileUuids: string[]) => {
      const targets = Array.from(new Set(fileUuids.filter(Boolean)));
      if (targets.length === 0) {
        return;
      }

      if (isBusy) {
        toast({
          title: "Another operation is running",
          description: "Please wait for the current task to finish before regenerating files.",
        });
        return;
      }

      setIsBusy(true);
      try {
        const plan = await ensureProjectConversionsPlan(projectId, targets);

        if (plan.integrityAlerts.length > 0) {
          const alertNames = plan.integrityAlerts.map((alert) => alert.fileName);
          toast({
            variant: "destructive",
            title: "File integrity issues",
            description: `Some inputs could not be read: ${alertNames.join(
              ", ",
            )}. Check the project files.`,
          });
        }

        if (plan.tasks.length === 0) {
          toast({
            title: "Nothing to regenerate",
            description: "No matching XLIFF conversions were scheduled for the selected files.",
          });
          return;
        }

        const affectedFiles = new Set(plan.tasks.map((task) => task.projectFileId));
        toast({
          title: affectedFiles.size > 1 ? "Regenerating files" : "Regenerating file",
          description: `Conversion pipeline started for ${affectedFiles.size} file${
            affectedFiles.size === 1 ? "" : "s"
          }.`,
        });

        const errors: string[] = [];
        let completedCount = 0;
        for (const task of plan.tasks) {
          try {
            await updateConversionStatus(task.conversionId, "running");

            const convertResult = await convertStream(
              {
                file: task.inputAbsPath,
                srcLang: task.srcLang,
                tgtLang: task.tgtLang,
                xliff: task.outputAbsPath,
                version: castXliffVersion(task.version),
                paragraph: task.paragraph,
                embed: task.embed,
              },
              {
                onStdout: (line) => console.debug("[openxliff]", line.trim()),
                onStderr: (line) => console.warn("[openxliff]", line.trim()),
              },
            );

            if (!convertResult.ok) {
              const detail = resolveConversionError(convertResult);
              errors.push(detail);
              await updateConversionStatus(task.conversionId, "failed", { errorMessage: detail });
              continue;
            }

            const validateResult = await validateStream({ xliff: task.outputAbsPath });
            if (!validateResult.ok) {
              const detail = resolveConversionError(validateResult);
              errors.push(detail);
              await updateConversionStatus(task.conversionId, "failed", { errorMessage: detail });
              continue;
            }

            const jliff = await convertXliffToJliff({
              projectId,
              conversionId: task.conversionId,
              xliffAbsPath: task.outputAbsPath,
              operator: summary?.name ?? summary?.clientName ?? undefined,
            });

            await updateConversionStatus(task.conversionId, "completed", {
              xliffRelPath: task.outputRelPath,
              xliffAbsPath: task.outputAbsPath,
              jliffRelPath: jliff.jliffRelPath,
              tagMapRelPath: jliff.tagMapRelPath,
              validation: {
                validator: "xliff_schema",
                passed: true,
                skipped: false,
                message:
                  validateResult.message ||
                  firstMeaningfulLine(validateResult.stdout) ||
                  firstMeaningfulLine(validateResult.stderr) ||
                  undefined,
              },
            });
            completedCount += 1;
          } catch (taskError) {
            const detail =
              taskError instanceof Error ? taskError.message : "Unknown conversion failure";
            errors.push(detail);
            await updateConversionStatus(task.conversionId, "failed", { errorMessage: detail });
          }
        }

        await refreshProjectData();

        if (errors.length > 0) {
          const successCount = plan.tasks.length - errors.length;
          toast({
            variant: successCount === 0 ? "destructive" : "default",
            title: successCount === 0 ? "Conversions failed" : "Conversions partially completed",
            description:
              successCount === 0
                ? errors[0]
                : `${successCount} succeeded, ${errors.length} failed. First error: ${errors[0]}`,
          });
        } else {
          const regeneratedFiles = affectedFiles.size || completedCount || plan.tasks.length;
          toast({
            title: "Conversion complete",
            description: `Regenerated ${regeneratedFiles} file${
              regeneratedFiles === 1 ? "" : "s"
            } successfully.`,
          });
        }
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "Unable to regenerate files.";
        toast({ variant: "destructive", title: "Regeneration failed", description });
      } finally {
        setIsBusy(false);
      }
    },
    [ensureProjectConversionsPlan, isBusy, projectId, refreshProjectData, summary, toast],
  );

  const handleRegenerateFile = useCallback(
    async (fileUuid: string) => {
      await runRegeneration([fileUuid]);
    },
    [runRegeneration],
  );

  const handleRegenerateFiles = useCallback(
    async (fileUuids: string[]) => {
      await runRegeneration(fileUuids);
    },
    [runRegeneration],
  );

  const providerValue = useMemo<ProjectOverviewContextValue>(
    () => ({ projectId, summary, bundle, statistics }),
    [bundle, projectId, statistics, summary],
  );

  return (
    <ProjectOverviewProvider value={providerValue}>
      <ProjectOverviewRouteContent
        isBusy={isBusy}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        onChangeRole={handleChangeRole}
        onRegenerateFile={handleRegenerateFile}
        onRegenerateFiles={handleRegenerateFiles}
      />
    </ProjectOverviewProvider>
  );
}

type RouteContentProps = {
  isBusy: boolean;
  onAddFiles: () => void;
  onRemoveFile: (fileUuid: string) => void;
  onChangeRole: (fileUuid: string, nextRole: ProjectFileRoleValue) => void;
  onRegenerateFile: (fileUuid: string) => Promise<void>;
  onRegenerateFiles: (fileUuids: string[]) => Promise<void>;
};

function ProjectOverviewRouteContent({
  isBusy,
  onAddFiles,
  onRemoveFile,
  onChangeRole,
  onRegenerateFile,
  onRegenerateFiles,
}: RouteContentProps) {
  const { summary, bundle, statistics } = useProjectOverviewContext();
  if (!summary || !bundle) {
    return <ProjectOverviewPage fallback />;
  }

  const files = Array.isArray(bundle.files) ? bundle.files : [];
  const languagePairs = Array.isArray(bundle.languagePairs) ? bundle.languagePairs : [];

  const references: typeof files = [];
  const instructions: typeof files = [];

  for (const entry of files) {
    const role = entry.file.type?.toLowerCase?.() ?? "processable";
    if (role === "reference") {
      references.push(entry);
    } else if (role === "instructions") {
      instructions.push(entry);
    }
  }

  const fileCount = files.length;
  const subjectLine =
    Array.isArray(summary.subjects) && summary.subjects.length > 0
      ? summary.subjects.join(", ")
      : "Not specified yet";

  const handleOpenFile = (fileId: string) => {
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "editor", projectId: summary.projectId, fileId },
      }),
    );
  };

  return (
    <ProjectOverviewPage
      summary={summary}
      fileCount={fileCount}
      languagePairs={languagePairs}
      files={files}
      references={references}
      instructions={instructions}
      onOpenFile={handleOpenFile}
      onRegenerateFile={onRegenerateFile}
      onRegenerateFiles={onRegenerateFiles}
      onRemoveFile={onRemoveFile}
      onChangeRole={onChangeRole}
      onAddFiles={onAddFiles}
      isBusy={isBusy}
      subjectLine={subjectLine}
      statistics={statistics}
    />
  );
}

function mapProjectRecordToListItem(record: ProjectRecord, bundle: ProjectBundle): ProjectListItem {
  const normalizedStatus = record.projectStatus?.toUpperCase?.() ?? "READY";
  return {
    projectId: record.projectUuid,
    name: record.projectName,
    slug: slugify(record.projectName || record.projectUuid),
    projectType: record.type,
    status: normalizedStatus,
    activityStatus: "pending",
    fileCount: bundle.files.length ?? record.fileCount ?? 0,
    createdAt: record.creationDate,
    updatedAt: record.updateDate,
    clientId: record.clientUuid ?? null,
    clientName: record.clientName ?? null,
    notes: record.notes ?? null,
    subjects: bundle.subjects.length > 0 ? [...bundle.subjects] : record.subjects ?? [],
  };
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function castXliffVersion(version?: string | null): "2.0" | "2.1" | "2.2" | undefined {
  if (!version) return undefined;
  if (version === "2.0" || version === "2.1" || version === "2.2") {
    return version;
  }
  return undefined;
}

function resolveConversionError(result: {
  knownError?: { detail?: string };
  message?: string;
  stderr?: string;
  stdout?: string;
}): string {
  return (
    result.knownError?.detail ||
    result.message ||
    firstMeaningfulLine(result.stderr) ||
    firstMeaningfulLine(result.stdout) ||
    "Conversion failed."
  );
}

function firstMeaningfulLine(input?: string | null): string | undefined {
  if (!input) return undefined;
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}
