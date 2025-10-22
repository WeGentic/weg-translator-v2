/**
 * @file High-level orchestrator for the Create Project wizard.
 *
 * The component focuses on aggregating state from specialised hooks and
 * delegates heavy business logic to dedicated modules for maintainability.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { X } from "lucide-react";

import { createClientRecord } from "@/core/ipc";
import type {
  ClientRecord,
  CreateClientInput,
  ProjectBundle,
} from "@/shared/types/database";
import { useAuth } from "@/app/providers";
import { Dialog, DialogClose, DialogContent } from "@/shared/ui/dialog";
import { useToast } from "@/shared/ui/use-toast";
import { cn } from "@/shared/utils/class-names";

import { PROJECT_FILE_EXTENSIONS } from "@/modules/project-manager/config";
import { WizardNewClientDialog, type WizardNewClientFormValues } from "@/modules/wizards/client";

import { WizardDetailsStep } from "./components/WizardDetailsStep";
import { WizardFeedbackOverlay } from "./components/WizardFeedbackOverlay";
import { WizardFilesStep } from "./components/WizardFilesStep";
import { WizardFooter } from "./components/WizardFooter";
import { createErrorFeedback } from "./feedback";
import { useWizardClients } from "./hooks/useWizardClients";
import { useWizardDropzone } from "./hooks/useWizardDropzone";
import { useWizardFiles } from "./hooks/useWizardFiles";
import { useWizardFinalize } from "./hooks/useWizardFinalize";
import { clearWizardDraftSnapshot, loadWizardDraftSnapshot, persistWizardDraftSnapshot } from "./draftStorage";
import type { WizardDraftSnapshot, WizardStep } from "./types";

import "./css/project-wizard-shell.css";
import "./css/project-wizard-form.css";
import "./css/project-wizard-autocomplete.css";
import "./css/project-wizard-combobox.css";
import "./css/project-wizard-language.css";
import "./css/project-wizard-actions.css";
import "./css/project-wizard-dropzone.css";
import "./css/project-wizard-files.css";
import "./css/project-wizard-feedback.css";

interface CreateProjectWizardV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (project: ProjectBundle) => void;
}

export function CreateProjectWizardV2({ open, onOpenChange, onProjectCreated }: CreateProjectWizardV2Props) {
  const { toast } = useToast();
  const { user: authenticatedUser } = useAuth();
  const [submissionPending, startSubmission] = useTransition();

  const initialDraftRef = useRef<WizardDraftSnapshot | null>(loadWizardDraftSnapshot());

  const [projectName, setProjectName] = useState(() => initialDraftRef.current?.projectName ?? "");
  const [clientName, setClientName] = useState(() => initialDraftRef.current?.clientName ?? "");
  const [selectedClientUuid, setSelectedClientUuid] = useState<string | null>(
    () => initialDraftRef.current?.selectedClientUuid ?? null,
  );
  const [isClientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientDialogInitialName, setClientDialogInitialName] = useState(() => initialDraftRef.current?.clientName ?? "");
  const [clientDialogSession, setClientDialogSession] = useState(0);
  const [projectField, setProjectField] = useState(() => initialDraftRef.current?.projectField ?? "");
  const [notes, setNotes] = useState(() => initialDraftRef.current?.notes ?? "");
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(
    () => initialDraftRef.current?.sourceLanguage ?? null,
  );
  const [targetLanguages, setTargetLanguages] = useState<string[]>(
    () => (initialDraftRef.current?.targetLanguages ? [...initialDraftRef.current.targetLanguages] : []),
  );
  const [step, setStep] = useState<WizardStep>(() => initialDraftRef.current?.step ?? "details");
  const [localResetCounter, setLocalResetCounter] = useState(0);

  const { files, fileCount, appendPaths, updateFileRole, removeFile, resetFiles } = useWizardFiles({
    initialFiles: initialDraftRef.current?.files,
  });

  useEffect(() => {
    initialDraftRef.current = null;
  }, []);
  const {
    clients,
    loading: clientsLoading,
    error: clientsError,
    refresh: refreshClients,
    upsert,
  } = useWizardClients();

  const {
    feedback,
    finalizeBusy,
    finalizeState,
    dismissFeedback,
    presentFeedback,
    handleFinalize,
    handleRetryFinalize,
  } = useWizardFinalize({
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
    authenticatedUserId: authenticatedUser?.id ?? null,
    setStep,
    onProjectCreated,
    onOpenChange,
    toast,
  });

  const showDropError = useCallback((message: string) => {
    presentFeedback(createErrorFeedback("validation", message));
  }, [presentFeedback]);

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

  useEffect(() => {
    if (!canClear) {
      clearWizardDraftSnapshot();
      return;
    }

    const snapshot: WizardDraftSnapshot = {
      step,
      projectName,
      clientName,
      selectedClientUuid,
      projectField,
      notes,
      sourceLanguage,
      targetLanguages,
      files,
      updatedAt: Date.now(),
    };

    persistWizardDraftSnapshot(snapshot);
  }, [
    canClear,
    step,
    projectName,
    clientName,
    selectedClientUuid,
    projectField,
    notes,
    sourceLanguage,
    targetLanguages,
    files,
  ]);

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
        presentFeedback(createErrorFeedback("filesystem", message));
      }
    })();
  }, [appendPaths, presentFeedback]);

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
    clearWizardDraftSnapshot();
    initialDraftRef.current = null;
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

  const handleFinalizeClick = useCallback(() => {
    handleFinalize({ onReset: handleClear });
  }, [handleFinalize, handleClear]);

  const handleRetryFinalizeClick = useCallback(() => {
    handleRetryFinalize({ onReset: handleClear });
  }, [handleClear, handleRetryFinalize]);

  useEffect(() => {
    if (!open) {
      setClientDialogOpen(false);
      resetDragState();
      dismissFeedback();
    }
  }, [open, dismissFeedback, resetDragState]);

  useEffect(() => {
    if (open) {
      refreshClients();
    }
  }, [open, refreshClients]);

  const trimmedProjectName = projectName.trim();
  const wizardHeaderTitle =
    step === "files" ? `${trimmedProjectName || "Unnamed Project"} - Add Files` : "Create New Project";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-label="Create new project"
        className={cn("wizard-v2-dialog")}
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

          <form className="wizard-v2-form mt-4" aria-label="New project details">
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
              onFinalize={handleFinalizeClick}
              finalizeBusy={finalizeBusy}
              submissionPending={submissionPending}
            />
          </form>

          <WizardFeedbackOverlay
            feedback={feedback}
            onDismiss={dismissFeedback}
            onRetry={!submissionPending ? handleRetryFinalizeClick : undefined}
          />
        </div>
      </DialogContent>

      <WizardNewClientDialog
        key={clientDialogSession}
        open={isClientDialogOpen}
        onOpenChange={closeClientDialog}
        initialName={clientDialogInitialName || clientName}
        onSubmit={handleClientDialogSubmit}
      />
    </Dialog>
  );
}

export { createProgressFeedback, createErrorFeedback, resolveFinalizeError } from "./feedback";
export { buildWizardFinalizePayload, buildCreateProjectWithAssetsInput } from "./finalizePayload";
export { deriveWizardConversionPlan, mapConversionPlanFromResponse, describeConversionTask } from "./conversionPlan";
