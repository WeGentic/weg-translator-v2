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

import { createProjectBundle } from "@/core/ipc";
import type { ProjectBundle } from "@/shared/types/database";
import { Dialog, DialogClose, DialogContent } from "@/shared/ui/dialog";
import { useToast } from "@/shared/ui/use-toast";
import { cn } from "@/shared/utils/class-names";
import { X } from "lucide-react";

import { PROJECT_FILE_EXTENSIONS } from "../../config";
import { DEFAULT_PROJECT_TYPE } from "./constants";
import { WizardDetailsStep } from "./components/WizardDetailsStep";
import { WizardFeedbackOverlay } from "./components/WizardFeedbackOverlay";
import { WizardFilesStep } from "./components/WizardFilesStep";
import { WizardFooter } from "./components/WizardFooter";
import { useWizardDropzone } from "./hooks/useWizardDropzone";
import { useWizardFiles } from "./hooks/useWizardFiles";
import type { DraftFileEntry, WizardFeedbackState, WizardStep } from "./types";
import { buildLanguagePairs, LanguagePairError } from "./utils/languagePairs";

import "./wizard-v2.css";

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
  const [projectField, setProjectField] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [step, setStep] = useState<WizardStep>("details");
  const [feedbackState, setFeedbackState] = useState<WizardFeedbackState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("Creating project…");
  const [localResetCounter, setLocalResetCounter] = useState(0);

  const { files, fileCount, appendPaths, updateFileRole, removeFile, resetFiles } = useWizardFiles();

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
      projectField.trim().length > 0 ||
      notes.trim().length > 0 ||
      sourceLanguage !== null ||
      targetLanguages.length > 0 ||
      fileCount > 0
    );
  }, [clientName, fileCount, notes, projectField, projectName, sourceLanguage, targetLanguages]);

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
    setProjectField("");
    setNotes("");
    setSourceLanguage(null);
    setTargetLanguages([]);
    resetFiles();
    resetDragState();
    setLocalResetCounter((value) => value + 1);
    setStep("details");
  }, [dismissFeedback, resetDragState, resetFiles]);

  const handleFinalize = useCallback(() => {
    if (!finalizeState.ready || submissionPending) {
      return;
    }

    const trimmedName = projectName.trim();
    const srcLang = sourceLanguage;
    const primaryTarget = targetLanguages[0] ?? null;

    if (!trimmedName || !srcLang || !primaryTarget) {
      setFeedbackState("error");
      setFeedbackMessage("Project details are incomplete. Please return to the Details step and fill in the missing fields.");
      setStep("details");
      return;
    }

    let languagePairs;

    try {
      languagePairs = buildLanguagePairs(srcLang, targetLanguages);
    } catch (validationError) {
      const message =
        validationError instanceof LanguagePairError
          ? validationError.message
          : "Check language selections before continuing.";
      setFeedbackState("error");
      setFeedbackMessage(message);
      setStep("details");
      toast({
        variant: "destructive",
        title: "Invalid language configuration",
        description: message,
      });
      return;
    }

    startSubmission(async () => {
      setFeedbackState("loading");
      setFeedbackMessage("Creating project…");

      try {
        const response = await createProjectBundle({
          projectName: trimmedName,
          projectStatus: "active",
          userUuid: LOCAL_OWNER_USER_ID,
          clientUuid: null,
          type: DEFAULT_PROJECT_TYPE,
          notes: notes ? notes : null,
          subjects: projectField ? [projectField] : [],
          languagePairs,
        });

        onProjectCreated?.(response);
        toast({
          title: "Project created",
          description: `${trimmedName} was created. TODO: wire file ingestion into the v2 pipeline.`,
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
    sourceLanguage,
    targetLanguages,
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

  return (
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
              <h2 className="wizard-v2-title">New Project Wizard</h2>
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
              onClientNameChange={setClientName}
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
  );
}
