/**
 * @file High-level orchestrator for the Create Project wizard.
 *
 * The component composes specialised hooks and step components to keep the file
 * responsibilities focused and predictable. Business logic stays here, while
 * each step concentrates purely on UI.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  useRef,
} from "react";

import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { createClientRecord, createProjectWithAssets, updateJobStatus, upsertArtifactRecord } from "@/core/ipc";
import { convertStream, validateStream } from "@/core/ipc/openxliff";
import type {
  ClientRecord,
  CreateClientInput,
  CreateProjectWithAssetsInput,
  CreateProjectWithAssetsResponse,
  ProjectBundle,
} from "@/shared/types/database";
import { Dialog, DialogClose, DialogContent } from "@/shared/ui/dialog";
import { useToast } from "@/shared/ui/use-toast";
import { cn } from "@/shared/utils/class-names";
import { X } from "lucide-react";

import { PROJECT_FILE_EXTENSIONS } from "../../config";
import { DEFAULT_PROJECT_TYPE } from "./constants";
import { WizardDetailsStep } from "./components/WizardDetailsStep";
import { WizardNewClientDialog, type WizardNewClientFormValues } from "./components/WizardNewClientDialog";
import { WizardFeedbackOverlay } from "./components/WizardFeedbackOverlay";
import { WizardFilesStep } from "./components/WizardFilesStep";
import { WizardFooter } from "./components/WizardFooter";
import { useWizardClients } from "./hooks/useWizardClients";
import { useWizardDropzone } from "./hooks/useWizardDropzone";
import { useWizardFiles } from "./hooks/useWizardFiles";
import type {
  DraftFileEntry,
  WizardStep,
  WizardProjectType,
  WizardFinalizeBuildResult,
  WizardFinalizePayload,
  WizardFinalizeFeedback,
  WizardFinalizePhase,
  WizardFinalizeErrorCategory,
  WizardFinalizeProgressDescriptor,
  WizardFinalizeErrorDescriptor,
  WizardFinalizeProgressEventPayload,
  WizardConversionPlan,
  WizardConversionTask,
} from "./types";
import { buildLanguagePairs, LanguagePairError } from "./utils/languagePairs";
import { extractFileName, extractFileStem, joinPathSegments } from "./utils";
import { generateUniqueProjectFolderName, sanitizeProjectFolderName } from "./utils/projectFolder";
import { getProjectsResourceSnapshot, refreshProjectsResource } from "../../data/projectsResource";

import "./wizard-v2.css";

const FINALIZE_PHASE_COPY: Record<WizardFinalizePhase, WizardFinalizeProgressDescriptor> = {
  "validating-input": {
    phase: "validating-input",
    headline: "Validating project data",
    description: "Checking project details before starting the creation flow.",
    actionLabel: "Validating…",
  },
  "creating-project-record": {
    phase: "creating-project-record",
    headline: "Creating project",
    description: "Saving project information and initial metadata.",
    actionLabel: "Creating…",
  },
  "preparing-folders": {
    phase: "preparing-folders",
    headline: "Preparing project folders",
    description: "Setting up the project directory structure on disk.",
    actionLabel: "Preparing…",
  },
  "copying-assets": {
    phase: "copying-assets",
    headline: "Copying project files",
    description: "Organising files according to their selected roles.",
    actionLabel: "Copying…",
  },
  "registering-database": {
    phase: "registering-database",
    headline: "Registering files",
    description: "Recording file metadata in the database.",
    actionLabel: "Saving…",
  },
  "planning-conversions": {
    phase: "planning-conversions",
    headline: "Planning conversions",
    description: "Scheduling translation conversions for each language pair.",
    actionLabel: "Planning…",
  },
  "running-conversions": {
    phase: "running-conversions",
    headline: "Converting files",
    description: "Generating XLIFF files for each language pair.",
    actionLabel: "Converting…",
  },
};

const PROJECT_CREATE_PROGRESS_EVENT = "project:create:progress";

function isWizardFinalizePhase(value: unknown): value is WizardFinalizePhase {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FINALIZE_PHASE_COPY, value)
  );
}

const FINALIZE_ERROR_COPY: Record<WizardFinalizeErrorCategory, Pick<WizardFinalizeErrorDescriptor, "headline" | "hint">> = {
  validation: {
    headline: "Check project information",
    hint: "Review the project details and language selections, then try again.",
  },
  filesystem: {
    headline: "Unable to prepare project folders",
    hint: "Verify the destination path is accessible and you have permission to create files.",
  },
  database: {
    headline: "Database update failed",
    hint: "The project was not saved. Try again or contact support if the issue persists.",
  },
  conversion: {
    headline: "Conversion planner failed",
    hint: "Check the uploaded files and language pairs before retrying.",
  },
  unknown: {
    headline: "We couldn’t complete the project setup",
    hint: "Retry the operation. If it keeps failing, gather logs and contact support.",
  },
};

const ERROR_CODE_CATEGORY: Record<string, WizardFinalizeErrorCategory> = {
  VALIDATION_FAILED: "validation",
  INVALID_PAYLOAD: "validation",
  LANGUAGE_PAIR_INVALID: "validation",
  PROJECT_NAME_CONFLICT: "validation",
  FS_CREATE_DIR_FAILED: "filesystem",
  FS_COPY_FAILED: "filesystem",
  FS_PERMISSION_DENIED: "filesystem",
  DB_TRANSACTION_FAILED: "database",
  DB_WRITE_FAILED: "database",
  DB_CONSTRAINT_VIOLATION: "database",
  CONVERSION_PLAN_FAILED: "conversion",
  CONVERSION_STREAM_FAILED: "conversion",
};

interface BackendErrorShape {
  code?: string;
  message?: string;
  detail?: string;
}

export function createProgressFeedback(
  phase: WizardFinalizePhase,
  descriptionOverride?: string,
): WizardFinalizeFeedback {
  const copy = FINALIZE_PHASE_COPY[phase];
  return {
    status: "progress",
    progress: {
      phase,
      headline: copy.headline,
      description: descriptionOverride ?? copy.description,
      actionLabel: copy.actionLabel,
    },
  };
}

export function createErrorFeedback(
  category: WizardFinalizeErrorCategory,
  description: string,
  detail?: string,
): WizardFinalizeFeedback {
  const copy = FINALIZE_ERROR_COPY[category];
  return {
    status: "error",
    error: {
      category,
      headline: copy.headline,
      description,
      detail,
      hint: copy.hint,
    },
  };
}

function normalizeIpcMessage(message: string): string {
  return message.replace(/^\[IPC\]\s+[\w-]+\s+failed:\s*/i, "").trim();
}

function parseBackendError(error: unknown): BackendErrorShape {
  if (error instanceof Error) {
    return { message: normalizeIpcMessage(error.message) };
  }

  if (typeof error === "string") {
    return { message: normalizeIpcMessage(error) };
  }

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    let code: string | undefined;
    let message: string | undefined;
    let detail: string | undefined;

    if (typeof candidate.code === "string") {
      code = candidate.code;
    }

    if (typeof candidate.message === "string") {
      message = candidate.message;
    }

    if (typeof candidate.detail === "string") {
      detail = candidate.detail;
    }

    const data = candidate.data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (!code && typeof record.code === "string") {
        code = record.code;
      }
      if (!message && typeof record.message === "string") {
        message = record.message;
      }
      if (!detail && typeof record.detail === "string") {
        detail = record.detail;
      }
    }

    if (!message && typeof candidate.error === "string") {
      message = candidate.error;
    }

    return {
      code,
      message: message ? normalizeIpcMessage(message) : undefined,
      detail,
    };
  }

  return {};
}

function inferCategoryFromMessage(message?: string): WizardFinalizeErrorCategory {
  if (!message) {
    return "unknown";
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("language") ||
    normalized.includes("valid") ||
    normalized.includes("required") ||
    normalized.includes("input")
  ) {
    return "validation";
  }

  if (
    normalized.includes("folder") ||
    normalized.includes("directory") ||
    normalized.includes("filesystem") ||
    normalized.includes("permission") ||
    normalized.includes("path")
  ) {
    return "filesystem";
  }

  if (
    normalized.includes("database") ||
    normalized.includes("sqlite") ||
    normalized.includes("constraint") ||
    normalized.includes("transaction")
  ) {
    return "database";
  }

  if (
    normalized.includes("convert") ||
    normalized.includes("xliff") ||
    normalized.includes("openxliff") ||
    normalized.includes("xlf")
  ) {
    return "conversion";
  }

  return "unknown";
}

function mapErrorCodeToCategory(code?: string, message?: string): WizardFinalizeErrorCategory {
  if (!code) {
    return inferCategoryFromMessage(message);
  }

  const normalized = code.toUpperCase();
  return ERROR_CODE_CATEGORY[normalized] ?? inferCategoryFromMessage(message);
}

export function resolveFinalizeError(error: unknown): WizardFinalizeFeedback {
  const parsed = parseBackendError(error);
  const category = mapErrorCodeToCategory(parsed.code, parsed.message);
  const description = parsed.message ?? FINALIZE_ERROR_COPY[category].hint ?? "Unknown error";
  const detail = parsed.detail;

  return createErrorFeedback(category, description, detail);
}

interface BuildWizardFinalizePayloadParams {
  projectName: string;
  projectType: WizardProjectType;
  userUuid: string;
  clientUuid: string | null;
  projectField: string;
  notes: string;
  sourceLanguage: string | null;
  targetLanguages: readonly string[];
  files: readonly DraftFileEntry[];
  existingFolderNames?: readonly string[];
}

export function buildWizardFinalizePayload(params: BuildWizardFinalizePayloadParams): WizardFinalizeBuildResult {
  const trimmedProjectName = params.projectName.trim();
  if (!trimmedProjectName) {
    return {
      success: false,
      issue: {
        focusStep: "details",
        message: "Provide a project name in the Details step before finalizing.",
      },
    };
  }

  const baseFolderName = sanitizeProjectFolderName(trimmedProjectName);
  if (!baseFolderName) {
    return {
      success: false,
      issue: {
        focusStep: "details",
        message: "Project name must include valid characters for a folder name.",
      },
    };
  }

  const existingFolderNames = params.existingFolderNames ?? [];
  const projectFolderName =
    existingFolderNames.length > 0
      ? generateUniqueProjectFolderName(trimmedProjectName, { existingNames: existingFolderNames })
      : baseFolderName;

  const resolvedFolderName = projectFolderName || baseFolderName;

  if (!params.sourceLanguage) {
    return {
      success: false,
      issue: {
        focusStep: "details",
        message: "Select a source language to continue.",
      },
    };
  }

  let languagePairs: WizardFinalizePayload["languagePairs"] = [];

  try {
    languagePairs = buildLanguagePairs(params.sourceLanguage, params.targetLanguages);
  } catch (cause) {
    const message =
      cause instanceof LanguagePairError
        ? cause.message
        : "Check language selections before continuing.";
    return {
      success: false,
      issue: {
        focusStep: "details",
        message,
      },
    };
  }

  if (params.files.length === 0) {
    return {
      success: false,
      issue: {
        focusStep: "files",
        message: "Add at least one file to finalize the project.",
      },
    };
  }

  const files: WizardFinalizePayload["files"] = [];

  for (const file of params.files) {
    const trimmedPath = file.path.trim();
    if (trimmedPath.length === 0) {
      return {
        success: false,
        issue: {
          focusStep: "files",
          message: `Resolve the missing path for ${file.name} before finalizing.`,
        },
      };
    }

    files.push({
      id: file.id,
      name: file.name,
      extension: file.extension,
      role: file.role,
      path: trimmedPath,
    });
  }

  const trimmedNotes = params.notes.trim();
  const subject = params.projectField.trim();

  return {
    success: true,
    payload: {
      projectName: trimmedProjectName,
      projectFolderName: resolvedFolderName,
      projectType: params.projectType,
      userUuid: params.userUuid,
      clientUuid: params.clientUuid,
      subjects: subject ? [subject] : [],
      notes: trimmedNotes ? trimmedNotes : null,
      languagePairs,
      files,
    },
  };
}

export function buildCreateProjectWithAssetsInput(
  payload: WizardFinalizePayload,
): CreateProjectWithAssetsInput {
  return {
    projectName: payload.projectName,
    projectFolderName: payload.projectFolderName,
    projectStatus: "active",
    userUuid: payload.userUuid,
    clientUuid: payload.clientUuid ?? undefined,
    type: payload.projectType,
    notes: payload.notes ?? undefined,
    subjects: payload.subjects,
    languagePairs: payload.languagePairs,
    assets: payload.files.map((file) => ({
      draftId: file.id,
      name: file.name,
      extension: file.extension,
      role: file.role,
      path: file.path,
    })),
  };
}

export function deriveWizardConversionPlan(
  response: CreateProjectWithAssetsResponse,
  input: CreateProjectWithAssetsInput,
): WizardConversionPlan {
  const projectUuid = response.project.project.projectUuid;
  const projectDir = response.projectDir;
  const tasks: WizardConversionPlan["tasks"] = [];

  for (const asset of response.assets) {
    if (asset.role !== "processable") {
      continue;
    }

    if (!asset.storedRelPath) {
      console.warn(
        "[wizard] Skipping conversion planning for asset without stored path",
        asset,
      );
      continue;
    }

    const sourceAbsPath = joinPathSegments(projectDir, asset.storedRelPath);
    const fileStem = extractFileStem(asset.storedRelPath);

    for (const pair of input.languagePairs) {
      const languageFolder = `${pair.sourceLang}_${pair.targetLang}`;
      const outputRelPath = joinPathSegments(
        "Translations",
        languageFolder,
        `${fileStem}.xlf`,
      );
      const outputAbsPath = joinPathSegments(projectDir, outputRelPath);

      tasks.push({
        draftId: asset.draftId,
        fileUuid: asset.fileUuid ?? null,
        artifactUuid: null,
        jobType: "xliff_conversion",
        sourceLanguage: pair.sourceLang,
        targetLanguage: pair.targetLang,
        sourceAbsPath,
        outputAbsPath,
        outputRelPath,
      });
    }
  }

  if (tasks.length > 0) {
    console.debug(
      "[wizard] Prepared conversion tasks for project",
      projectUuid,
      tasks.map((task) => ({
        draftId: task.draftId,
        source: task.sourceAbsPath,
        target: task.outputAbsPath,
        pair: `${task.sourceLanguage}→${task.targetLanguage}`,
      })),
    );
  } else {
    console.debug(
      "[wizard] No conversion tasks generated for project (no processable assets or language pairs)",
      projectUuid,
    );
  }

  return {
    projectUuid,
    projectDir,
    tasks,
  };
}

export function mapConversionPlanFromResponse(
  response: CreateProjectWithAssetsResponse,
): WizardConversionPlan | null {
  const plan = response.conversionPlan;
  if (!plan) {
    return null;
  }

  const { projectUuid, tasks } = plan;
  const projectDir = response.projectDir;

  return {
    projectUuid,
    projectDir,
    tasks: tasks.map((task) => ({
      draftId: task.draftId,
      fileUuid: task.fileUuid ?? null,
      artifactUuid: task.artifactUuid ?? null,
      jobType: task.jobType ?? null,
      sourceLanguage: task.sourceLang,
      targetLanguage: task.targetLang,
      sourceAbsPath: task.sourcePath,
      outputRelPath: task.xliffRelPath,
      outputAbsPath: joinPathSegments(projectDir, task.xliffRelPath),
    })),
  };
}

export function describeConversionTask(task: WizardConversionTask, index: number, total: number): string {
  const fileName = extractFileName(task.sourceAbsPath);
  const position = `${index + 1} of ${total}`;
  return `Converting ${fileName} (${task.sourceLanguage} → ${task.targetLanguage}) — ${position}.`;
}

interface CreateProjectWizardV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (project: ProjectBundle) => void;
}

interface FinalizeState {
  ready: boolean;
  reason: string | null;
}

export function CreateProjectWizardV2({ open, onOpenChange, onProjectCreated }: CreateProjectWizardV2Props) {
  const { toast } = useToast();
  const LOCAL_OWNER_USER_ID = "local-user";
  const [submissionPending, startSubmission] = useTransition();
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedClientUuid, setSelectedClientUuid] = useState<string | null>(null);
  const [isClientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientDialogInitialName, setClientDialogInitialName] = useState("");
  const [clientDialogSession, setClientDialogSession] = useState(0);
  const [projectField, setProjectField] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [step, setStep] = useState<WizardStep>("details");
  const [feedback, setFeedback] = useState<WizardFinalizeFeedback>({ status: "idle" });
  const [localResetCounter, setLocalResetCounter] = useState(0);

  const { files, fileCount, appendPaths, updateFileRole, removeFile, resetFiles } = useWizardFiles();
  const {
    clients,
    loading: clientsLoading,
    error: clientsError,
    refresh: refreshClients,
    upsert,
  } = useWizardClients();

  const dismissFeedback = useCallback(() => {
    setFeedback({ status: "idle" });
  }, []);

  const conversionPlanRef = useRef<WizardConversionPlan | null>(null);

  const runConversionPlan = useCallback(
    async (plan: WizardConversionPlan) => {
      if (plan.tasks.length === 0) {
        return;
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
            console.warn(
              "[wizard] failed to update job status",
              status,
              jobError,
            );
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
            console.warn(
              "[wizard] failed to persist artifact metadata",
              artifactError,
            );
          }
        };

        await markJobStatus("running");

        const result = await convertStream(
          {
            file: task.sourceAbsPath,
            srcLang: task.sourceLanguage,
            tgtLang: task.targetLanguage,
            xliff: task.outputAbsPath,
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

          throw {
            code: "CONVERSION_STREAM_FAILED",
            message,
            detail,
          } satisfies BackendErrorShape;
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

          throw {
            code: "VALIDATION_FAILED",
            message,
            detail,
          } satisfies BackendErrorShape;
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
    },
    [setFeedback],
  );

  const showDropError = useCallback((message: string) => {
    setFeedback(
      createErrorFeedback("validation", message),
    );
  }, []);

  const {
    isDragActive,
    isDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    resetDragState,
  } = useWizardDropzone({
    onPathsCaptured: appendPaths,
    onDropError: showDropError,
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const toggleTargetLanguage = useCallback((code: string) => {
    setTargetLanguages((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  }, []);

  const removeTargetLanguage = useCallback((code: string) => {
    setTargetLanguages((current) => current.filter((value) => value !== code));
  }, []);

  const handleClientNameChange = useCallback((value: string) => {
    setClientName(value);
  }, []);

  const handleClientSelect = useCallback((client: ClientRecord | null) => {
    if (client) {
      setSelectedClientUuid(client.clientUuid);
      setClientName(client.name);
    } else {
      setSelectedClientUuid(null);
    }
  }, []);

  const openClientDialog = useCallback((initialName: string) => {
    setClientDialogInitialName(initialName.trim());
    setClientDialogSession((value) => value + 1);
    setClientDialogOpen(true);
  }, []);

  const closeClientDialog = useCallback((nextOpen: boolean) => {
    setClientDialogOpen(nextOpen);
  }, []);

  const handleClientDialogSubmit = useCallback(
    async (values: WizardNewClientFormValues) => {
      const normalize = (input: string) => {
        const trimmed = input.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const payload: CreateClientInput = {
        name: values.name.trim(),
        email: normalize(values.email),
        phone: normalize(values.phone),
        address: normalize(values.address),
        vatNumber: normalize(values.vatNumber),
        note: normalize(values.note),
      };

      try {
        const created = await createClientRecord(payload);
        upsert(created);
        handleClientSelect(created);
        toast({
          title: "Client added",
          description: `${created.name} is now available for this project.`,
        });
      } catch (cause: unknown) {
        const message =
          cause instanceof Error && cause.message ? cause.message : "Unable to save client. Please try again.";
        throw new Error(message);
      }
    },
    [handleClientSelect, toast, upsert],
  );

  const finalizeState = useMemo<FinalizeState>(() => {
    if (submissionPending || feedback.status === "progress") {
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

    if (files.some((entry: DraftFileEntry) => entry.path.trim().length === 0)) {
      return { ready: false, reason: "One or more files are missing a resolved path. Re-add them and try again." };
    }

    return { ready: true, reason: null };
  }, [submissionPending, feedback.status, projectName, sourceLanguage, targetLanguages, fileCount, files]);

  const canClear = useMemo(() => {
    return (
      projectName.trim().length > 0 ||
      clientName.trim().length > 0 ||
      selectedClientUuid !== null ||
      projectField.trim().length > 0 ||
      notes.trim().length > 0 ||
      sourceLanguage !== null ||
      targetLanguages.length > 0 ||
      fileCount > 0
    );
  }, [clientName, fileCount, notes, projectField, projectName, selectedClientUuid, sourceLanguage, targetLanguages]);

  const isNextEnabled = useMemo(() => {
    const hasName = projectName.trim().length > 0;
    const hasSource = sourceLanguage !== null;
    const hasTargets = targetLanguages.length > 0;
    const hasField = projectField.trim().length > 0;
    return hasName && hasSource && hasTargets && hasField;
  }, [projectField, projectName, sourceLanguage, targetLanguages]);

  const handleBrowseClick = useCallback(() => {
    void (async () => {
      try {
        const selection = await openFileDialog({
          multiple: true,
          filters: [
            {
              name: "Supported files",
              extensions: [...PROJECT_FILE_EXTENSIONS],
            },
          ],
        });

        if (!selection) return;

        const selectionArray = Array.isArray(selection) ? selection : [selection];
        appendPaths(selectionArray);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "We couldn't access the selected files. Please try again.";
        setFeedback(createErrorFeedback("filesystem", message));
      }
    })();
  }, [appendPaths]);

  const handleNext = useCallback(() => {
    if (!isNextEnabled) {
      return;
    }
    setStep("files");
  }, [isNextEnabled]);

  const handleBack = useCallback(() => {
    setStep("details");
    resetDragState();
  }, [resetDragState]);

  const handleClear = useCallback(() => {
    dismissFeedback();
    setProjectName("");
    setClientName("");
    setSelectedClientUuid(null);
    setProjectField("");
    setNotes("");
    setSourceLanguage(null);
    setTargetLanguages([]);
    setClientDialogInitialName("");
    setClientDialogOpen(false);
    setClientDialogSession(0);
    resetFiles();
    resetDragState();
    setLocalResetCounter((value) => value + 1);
    setStep("details");
  }, [dismissFeedback, resetDragState, resetFiles]);

  const handleFinalize = useCallback(() => {
    if (!finalizeState.ready || submissionPending) {
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
      userUuid: LOCAL_OWNER_USER_ID,
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

      try {
        try {
          unlistenProgress = await listen<WizardFinalizeProgressEventPayload>(
            PROJECT_CREATE_PROGRESS_EVENT,
            (event) => {
              const payload = event.payload;
              if (!payload) {
                return;
              }

              const { phase, description, projectFolderName } = payload;

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
        conversionPlanRef.current = conversionPlan;

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
          await runConversionPlan(conversionPlan);
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
        handleClear();
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
  }, [
    finalizeState.ready,
    submissionPending,
    projectName,
    projectField,
    notes,
    selectedClientUuid,
    sourceLanguage,
    targetLanguages,
    files,
    setFeedback,
    startSubmission,
    runConversionPlan,
    onProjectCreated,
    toast,
    handleClear,
    onOpenChange,
  ]);

  const handleRetryFinalize = useCallback(() => {
    if (submissionPending) {
      return;
    }
    dismissFeedback();
    handleFinalize();
  }, [dismissFeedback, handleFinalize, submissionPending]);

  const resetWizardOnClose = useCallback(() => {
    handleClear();
  }, [handleClear]);

  useEffect(() => {
    if (!open) {
      resetWizardOnClose();
    }
  }, [open, resetWizardOnClose]);

  useEffect(() => {
    if (open) {
      refreshClients();
    }
  }, [open, refreshClients]);

  const trimmedProjectName = projectName.trim();
  const wizardHeaderTitle =
    step === "files" ? `${trimmedProjectName || "Unnamed Project"} - FILE MANAGER` : "New Project Wizard";
  const finalizeBusy = feedback.status === "progress";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          aria-label="Create project wizard"
          className={cn("wizard-v2-dialog border-0 bg-transparent p-0")}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
          }}
        >
          <div className="wizard-v2-modal">
            <header className="wizard-v2-header">
              <div className="wizard-v2-header-bar">
                <h2 className="wizard-v2-title">{wizardHeaderTitle}</h2>
                <DialogClose type="button" className="wizard-v2-close" aria-label="Close wizard">
                  <X className="h-4 w-4" aria-hidden="true" />
                </DialogClose>
              </div>
            </header>

            <form className="wizard-v2-form" aria-label="New project details">
              {step === "details" ? (
                <WizardDetailsStep
                  key={localResetCounter}
                  projectName={projectName}
                  onProjectNameChange={setProjectName}
                  clientName={clientName}
                  onClientNameChange={handleClientNameChange}
                  clientOptions={clients}
                  clientLoading={clientsLoading}
                  clientErrorMessage={clientsError}
                  selectedClientUuid={selectedClientUuid}
                  onClientSelect={handleClientSelect}
                  onRequestClientCreate={openClientDialog}
                  projectField={projectField}
                  onProjectFieldChange={setProjectField}
                  notes={notes}
                  onNotesChange={setNotes}
                  sourceLanguage={sourceLanguage}
                  onSourceLanguageSelect={setSourceLanguage}
                  targetLanguages={targetLanguages}
                  onToggleTargetLanguage={toggleTargetLanguage}
                  onRemoveTargetLanguage={removeTargetLanguage}
                />
              ) : (
                <WizardFilesStep
                  files={files}
                  fileCount={fileCount}
                  isDragActive={isDragActive}
                  isDragOver={isDragOver}
                  onBrowseClick={handleBrowseClick}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onRoleChange={updateFileRole}
                  onRemoveFile={removeFile}
                />
              )}

              <WizardFooter
                step={step}
                canClear={canClear}
                onClear={handleClear}
                onNext={handleNext}
                isNextEnabled={isNextEnabled}
                onBack={handleBack}
              finalizeDisabled={!finalizeState.ready}
              finalizeReason={finalizeState.reason}
              onFinalize={handleFinalize}
              finalizeBusy={finalizeBusy}
              submissionPending={submissionPending}
            />
          </form>

          <WizardFeedbackOverlay
            feedback={feedback}
            onDismiss={dismissFeedback}
            onRetry={!submissionPending ? handleRetryFinalize : undefined}
          />
        </div>
      </DialogContent>
      </Dialog>

      <WizardNewClientDialog
        key={clientDialogSession}
        open={isClientDialogOpen}
        onOpenChange={closeClientDialog}
        initialName={clientDialogInitialName || clientName}
        onSubmit={handleClientDialogSubmit}
      />
    </>
  );
}
