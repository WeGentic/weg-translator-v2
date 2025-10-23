/**
 * @file Finalize workflow hook for the create project wizard.
 *
 * Encapsulates the async flow that persists the project, listens to backend
 * progress events, and orchestrates XLIFF conversions to keep the component
 * focused on rendering concerns.
 */

import { useCallback, useMemo, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { createProjectWithAssets, updateJobStatus, upsertArtifactRecord } from "@/core/ipc";
import { convertStream, validateStream } from "@/core/ipc/openxliff";

import type { ProjectBundle } from "@/shared/types/database";
import type { ToastOptions } from "@/shared/ui/use-toast";

import {
  DEFAULT_PROJECT_TYPE,
  PROJECT_CREATE_PROGRESS_EVENT,
  XLIFF_TARGET_VERSION,
} from "../constants";
import {
  createErrorFeedback,
  createProgressFeedback,
  isWizardFinalizePhase,
  resolveFinalizeError,
} from "../feedback";
import {
  buildCreateProjectWithAssetsInput,
  buildWizardFinalizePayload,
} from "../finalizePayload";
import {
  describeConversionTask,
  deriveWizardConversionPlan,
  mapConversionPlanFromResponse,
} from "../conversionPlan";
import { extractFileName } from "../utils";
import {
  getProjectsResourceSnapshot,
  refreshProjectsResource,
} from "@/modules/project-manager/data/projectsResource";
import type {
  DraftFileEntry,
  WizardConversionPlan,
  WizardFinalizeFeedback,
  WizardFinalizeProgressEventPayload,
  WizardStep,
} from "../types";
import { sanitizeProjectFolderName } from "../utils/projectFolder";

type ToastInvoker = (options: ToastOptions) => string;

interface UseWizardFinalizeParams {
  projectName: string;
  projectField: string;
  notes: string;
  selectedClientUuid: string | null;
  sourceLanguage: string | null;
  targetLanguages: readonly string[];
  files: readonly DraftFileEntry[];
  fileCount: number;
  submissionPending: boolean;
  startSubmission: (task: () => void | Promise<void>) => void;
  authenticatedUserId: string | null;
  setStep: (step: WizardStep) => void;
  onProjectCreated?: (project: ProjectBundle) => void;
  onOpenChange: (open: boolean) => void;
  toast: ToastInvoker;
}

export interface FinalizeState {
  ready: boolean;
  reason: string | null;
}

interface FinalizeOptions {
  onReset: () => void;
}

class ConversionStreamError extends Error {
  code?: string;
  detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = "ConversionStreamError";
    this.code = "CONVERSION_STREAM_FAILED";
    this.detail = detail;
  }
}

export function useWizardFinalize({
  projectName,
  projectField,
  notes,
  selectedClientUuid,
  sourceLanguage,
  targetLanguages,
  files,
  fileCount,
  submissionPending,
  startSubmission,
  authenticatedUserId,
  setStep,
  onProjectCreated,
  onOpenChange,
  toast,
}: UseWizardFinalizeParams) {
  const [feedback, setFeedback] = useState<WizardFinalizeFeedback>({ status: "idle" });
  const finalizeBusy = feedback.status === "progress";

  const finalizeState = useMemo<FinalizeState>(() => {
    if (submissionPending || finalizeBusy) {
      return { ready: false, reason: "Project creation is already running." };
    }

    if (!projectName.trim()) {
      return { ready: false, reason: "Provide a project name in the Details step before finalizing." };
    }

    if (!sourceLanguage) {
      return { ready: false, reason: "Select a source language to continue." };
    }

    if (targetLanguages.length === 0) {
      return { ready: false, reason: "Add at least one target language." };
    }

    if (fileCount === 0) {
      return { ready: false, reason: "Add at least one file to finalize the project." };
    }

    if (files.some((entry) => entry.path.trim().length === 0)) {
      return { ready: false, reason: "One or more files are missing a resolved path. Re-add them and try again." };
    }

    if (files.some((entry) => entry.role === "undefined")) {
      return { ready: false, reason: "Assign a role to each file before finalizing the project." };
    }

    return { ready: true, reason: null };
  }, [submissionPending, finalizeBusy, projectName, sourceLanguage, targetLanguages, fileCount, files]);

  const dismissFeedback = useCallback(() => {
    setFeedback({ status: "idle" });
  }, []);

  const presentFeedback = useCallback((next: WizardFinalizeFeedback) => {
    setFeedback(next);
  }, []);

  const runConversionPlan = useCallback(
    async (plan: WizardConversionPlan): Promise<string[]> => {
      const validationWarnings: string[] = [];
      if (plan.tasks.length === 0) {
        return validationWarnings;
      }

      const total = plan.tasks.length;

      for (let index = 0; index < total; index += 1) {
        const task = plan.tasks[index];
        const description = describeConversionTask(task, index, total);
        setFeedback(createProgressFeedback("running-conversions", description));

        const markJobStatus = async (
          status: "pending" | "running" | "completed" | "failed",
          errorLog?: string,
        ) => {
          if (!task.artifactUuid || !task.jobType) {
            return;
          }

          try {
            await updateJobStatus({
              artifactUuid: task.artifactUuid,
              jobType: task.jobType,
              jobStatus: status,
              errorLog,
            });
          } catch (jobError) {
            console.warn("[wizard] failed to update job status", status, jobError);
          }
        };

        const markArtifactGenerated = async () => {
          if (!task.artifactUuid || !task.fileUuid) {
            return;
          }

          try {
            await upsertArtifactRecord({
              artifactUuid: task.artifactUuid,
              projectUuid: plan.projectUuid,
              fileUuid: task.fileUuid,
              artifactType: "xliff",
              status: "GENERATED",
            });
          } catch (artifactError) {
            console.warn("[wizard] failed to persist artifact metadata", artifactError);
          }
        };

        await markJobStatus("running");

        const result = await convertStream(
          {
            file: task.sourceAbsPath,
            srcLang: task.sourceLanguage,
            tgtLang: task.targetLanguage,
            xliff: task.outputAbsPath,
            version: XLIFF_TARGET_VERSION,
            embed: true,
            paragraph: true,
          },
          {
            onStdout: (line) => {
              if (line.trim().length > 0) {
                console.debug("[wizard] convert stdout", line.trim());
              }
            },
            onStderr: (line) => {
              if (line.trim().length > 0) {
                console.warn("[wizard] convert stderr", line.trim());
              }
            },
          },
        );

        if (!result?.ok) {
          const message =
            result?.knownError?.message ??
            result?.message ??
            `Conversion failed for ${extractFileName(task.sourceAbsPath)}.`;
          const detailCandidate =
            result?.knownError?.detail ??
            result?.stderr ??
            result?.stdout ??
            undefined;
          const detail = detailCandidate && detailCandidate.trim().length > 0 ? detailCandidate.trim() : undefined;

          await markJobStatus("failed", detail ?? message);

          throw new ConversionStreamError(message, detail);
        }

        const validationResult = await validateStream(
          { xliff: task.outputAbsPath },
          {
            onStdout: (line) => {
              if (line.trim().length > 0) {
                console.debug("[wizard] validate stdout", line.trim());
              }
            },
            onStderr: (line) => {
              if (line.trim().length > 0) {
                console.warn("[wizard] validate stderr", line.trim());
              }
            },
          },
        );

        if (!validationResult.ok) {
          const message =
            validationResult.knownError?.message ??
            validationResult.message ??
            `Validation failed for ${extractFileName(task.outputAbsPath)}.`;
          const detailCandidate =
            validationResult.knownError?.detail ??
            validationResult.stderr ??
            validationResult.stdout ??
            undefined;
          const detail = detailCandidate && detailCandidate.trim().length > 0 ? detailCandidate.trim() : undefined;

          await markJobStatus("failed", detail ?? message);
          validationWarnings.push(detail ?? message);
          console.warn("[wizard] xliff validation warning", {
            task: task.draftId,
            message,
            detail,
          });
          continue;
        }

        await markJobStatus("completed");
        await markArtifactGenerated();
      }

      setFeedback(
        createProgressFeedback(
          "running-conversions",
          "Conversions completed successfully.",
        ),
      );

      return validationWarnings;
    },
    [setFeedback],
  );

  const handleFinalize = useCallback(
    ({ onReset }: FinalizeOptions) => {
      if (!finalizeState.ready || submissionPending) {
        return;
      }

      if (!authenticatedUserId) {
        const message = "You need to be signed in to create a project.";
        setFeedback(createErrorFeedback("validation", message));
        toast({
          variant: "destructive",
          title: "Authentication required",
          description: message,
        });
        return;
      }

      const snapshot = getProjectsResourceSnapshot();
      const existingFolderNames = Array.from(
        new Set(
          snapshot.data
            .map((project) => sanitizeProjectFolderName(project.name ?? ""))
            .filter((name): name is string => Boolean(name)),
        ),
      );

      const finalizeResult = buildWizardFinalizePayload({
        projectName,
        projectType: DEFAULT_PROJECT_TYPE,
        userUuid: authenticatedUserId,
        clientUuid: selectedClientUuid ?? null,
        projectField,
        notes,
        sourceLanguage,
        targetLanguages,
        files,
        existingFolderNames,
      });

      if (!finalizeResult.success) {
        setFeedback(createErrorFeedback("validation", finalizeResult.issue.message));
        setStep(finalizeResult.issue.focusStep);
        toast({
          variant: "destructive",
          title: "Cannot finalize project",
          description: finalizeResult.issue.message,
        });
        return;
      }

      const payload = finalizeResult.payload;
      const commandInput = buildCreateProjectWithAssetsInput(payload);

      startSubmission(async () => {
        setFeedback(createProgressFeedback("validating-input"));

        let unlistenProgress: UnlistenFn | null = null;
        let conversionWarnings: string[] = [];

        try {
          try {
            unlistenProgress = await listen<WizardFinalizeProgressEventPayload>(
              PROJECT_CREATE_PROGRESS_EVENT,
              (event) => {
                const eventPayload = event.payload;
                if (!eventPayload) {
                  return;
                }

                const { phase, description, projectFolderName } = eventPayload;

                if (
                  projectFolderName &&
                  projectFolderName !== commandInput.projectFolderName
                ) {
                  return;
                }

                if (isWizardFinalizePhase(phase)) {
                  setFeedback(createProgressFeedback(phase, description));
                }
              },
            );
          } catch (listenerError) {
            console.warn(
              "[wizard] failed to register project create progress listener",
              listenerError,
            );
          }

          console.debug("[wizard] finalize payload", payload);
          console.debug("[wizard] createProjectWithAssets input", commandInput);
          const response = await createProjectWithAssets(commandInput);
          console.debug("[wizard] createProjectWithAssets response", response);

          const conversionPlan =
            mapConversionPlanFromResponse(response) ??
            deriveWizardConversionPlan(response, commandInput);

          const processableCount = response.assets.filter(
            (asset) => asset.role === "processable" && asset.storedRelPath,
          ).length;
          const expectedTasks = processableCount * commandInput.languagePairs.length;
          if (expectedTasks > 0 && conversionPlan.tasks.length !== expectedTasks) {
            console.warn(
              "[wizard] Conversion plan mismatch detected",
              { expectedTasks, actualTasks: conversionPlan.tasks.length },
            );
          }

          if (conversionPlan.tasks.length > 0) {
            conversionWarnings = await runConversionPlan(conversionPlan);
          }

          onProjectCreated?.(response.project);
          void refreshProjectsResource().catch((refreshError) => {
            console.warn(
              "[wizard] failed to refresh projects resource after creation",
              refreshError,
            );
          });
          toast({
            title: "Project created",
            description: `${payload.projectName} has been created and initial conversions completed.`,
          });
          if (conversionWarnings.length > 0) {
            toast({
              variant: "destructive",
              title: "XLIFF validation warnings",
              description: conversionWarnings.join("\n"),
            });
          }
          onReset();
          onOpenChange(false);
        } catch (error) {
          const errorFeedback = resolveFinalizeError(error);
          setFeedback(errorFeedback);
          console.error("[wizard] finalize failed", error);
          if (errorFeedback.status === "error") {
            toast({
              variant: "destructive",
              title: errorFeedback.error.headline,
              description: errorFeedback.error.description,
            });
          } else {
            toast({
              variant: "destructive",
              title: "Unable to create project",
              description: "We couldn't create the project. Please review the inputs and try again.",
            });
          }
        } finally {
          if (unlistenProgress) {
            try {
              unlistenProgress();
            } catch (cleanupError) {
              console.warn("[wizard] failed to remove progress listener", cleanupError);
            }
          }
        }
      });
    },
    [
      finalizeState.ready,
      submissionPending,
      authenticatedUserId,
      setFeedback,
      toast,
      projectName,
      selectedClientUuid,
      projectField,
      notes,
      sourceLanguage,
      targetLanguages,
      files,
      setStep,
      startSubmission,
      onProjectCreated,
      onOpenChange,
      runConversionPlan,
    ],
  );

  const handleRetryFinalize = useCallback(
    ({ onReset }: FinalizeOptions) => {
      if (submissionPending) {
        return;
      }
      dismissFeedback();
      handleFinalize({ onReset });
    },
    [dismissFeedback, handleFinalize, submissionPending],
  );

  return {
    feedback,
    finalizeBusy,
    finalizeState,
    dismissFeedback,
    presentFeedback,
    handleFinalize,
    handleRetryFinalize,
  };
}
