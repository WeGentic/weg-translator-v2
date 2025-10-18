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
} from "react";

import { open as openFileDialog } from "@tauri-apps/plugin-dialog";

import { createClientRecord, createProjectBundle } from "@/core/ipc";
import type { ClientRecord, CreateClientInput, ProjectBundle } from "@/shared/types/database";
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
  WizardFeedbackState,
  WizardStep,
  WizardProjectType,
  WizardFinalizeBuildResult,
  WizardFinalizePayload,
} from "./types";
import { buildLanguagePairs, LanguagePairError } from "./utils/languagePairs";

import "./wizard-v2.css";

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
const RESERVED_WINDOWS_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

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
}

function sanitizeProjectFolderName(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return "";
  }

  const withoutForbidden = trimmed.replace(INVALID_FOLDER_CHARS, "");
  const collapsedWhitespace = withoutForbidden.replace(/\s+/g, " ");
  const strippedEdges = collapsedWhitespace.replace(/^[. ]+|[. ]+$/g, "").trim();

  if (strippedEdges.length === 0) {
    return "";
  }

  const reservedSafe = RESERVED_WINDOWS_NAMES.has(strippedEdges.toUpperCase())
    ? `_${strippedEdges}`
    : strippedEdges;

  return reservedSafe.slice(0, 120);
}

function buildWizardFinalizePayload(params: BuildWizardFinalizePayloadParams): WizardFinalizeBuildResult {
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

  const projectFolderName = sanitizeProjectFolderName(trimmedProjectName);
  if (!projectFolderName) {
    return {
      success: false,
      issue: {
        focusStep: "details",
        message: "Project name must include valid characters for a folder name.",
      },
    };
  }

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
      projectFolderName,
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
  const [feedbackState, setFeedbackState] = useState<WizardFeedbackState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("Creating project…");
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
    setFeedbackState("idle");
    setFeedbackMessage("Creating project…");
  }, []);

  const showDropError = useCallback((message: string) => {
    setFeedbackState("error");
    setFeedbackMessage(message);
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
    if (submissionPending || feedbackState === "loading") {
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
  }, [submissionPending, feedbackState, projectName, sourceLanguage, targetLanguages, fileCount, files]);

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
        setFeedbackState("error");
        setFeedbackMessage(message);
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
    });

    if (!finalizeResult.success) {
      setFeedbackState("error");
      setFeedbackMessage(finalizeResult.issue.message);
      setStep(finalizeResult.issue.focusStep);
      toast({
        variant: "destructive",
        title: "Cannot finalize project",
        description: finalizeResult.issue.message,
      });
      return;
    }

    const payload = finalizeResult.payload;

    startSubmission(async () => {
      setFeedbackState("loading");
      setFeedbackMessage("Creating project…");

      try {
        console.debug("[wizard] finalize payload", payload);
        const response = await createProjectBundle({
          projectName: payload.projectName,
          projectStatus: "active",
          userUuid: payload.userUuid,
          clientUuid: payload.clientUuid,
          type: payload.projectType,
          notes: payload.notes,
          subjects: payload.subjects,
          languagePairs: payload.languagePairs,
        });

        onProjectCreated?.(response);
        toast({
          title: "Project created",
          description: `${payload.projectName} was created. TODO: wire file ingestion into the v2 pipeline.`,
        });
        handleClear();
        onOpenChange(false);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "We couldn't create the project. Please review the inputs and try again.";
        setFeedbackState("error");
        setFeedbackMessage(message);
        toast({
          variant: "destructive",
          title: "Unable to create project",
          description: message,
        });
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
    startSubmission,
    onProjectCreated,
    toast,
    handleClear,
    onOpenChange,
  ]);

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
                feedbackState={feedbackState}
                submissionPending={submissionPending}
              />
            </form>

            <WizardFeedbackOverlay state={feedbackState} message={feedbackMessage} onDismiss={dismissFeedback} />
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
