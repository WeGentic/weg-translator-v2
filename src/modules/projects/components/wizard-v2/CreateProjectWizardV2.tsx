import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { CreateProjectResponse } from "@/core/ipc";
import { Dialog, DialogClose, DialogContent } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/class-names";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  FileText,
  FileUp,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { COMMON_LANGUAGES, type LanguageOption } from "../wizard/utils/languages";

import "./wizard-v2.css";

type EnhancedLanguageOption = LanguageOption & { compactLabel: string };

type WizardStep = "details" | "files";

const FILE_ROLE_LABELS = {
  processable: "Processable",
  reference: "Reference",
  instructions: "Instructions",
  image: "Image",
} as const;

const EDITABLE_FILE_ROLE_OPTIONS = [
  { value: "processable", label: FILE_ROLE_LABELS.processable },
  { value: "reference", label: FILE_ROLE_LABELS.reference },
  { value: "instructions", label: FILE_ROLE_LABELS.instructions },
] as const;

type FileRoleValue = keyof typeof FILE_ROLE_LABELS;

interface DraftFileEntry {
  id: string;
  name: string;
  extension: string;
  role: FileRoleValue;
}

const PROJECT_FIELDS = [
  { value: "marketing", label: "Marketing & Creative" },
  { value: "legal", label: "Legal" },
  { value: "technical", label: "Technical" },
  { value: "medical", label: "Medical" },
  { value: "finance", label: "Finance" },
  { value: "software", label: "Software & IT" },
] as const;

interface CreateProjectWizardV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (project: CreateProjectResponse) => void;
}

export function CreateProjectWizardV2({ open, onOpenChange }: CreateProjectWizardV2Props) {
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectField, setProjectField] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("details");
  const [files, setFiles] = useState<DraftFileEntry[]>([]);
  const fileIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);
  const feedbackTimerRef = useRef<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedbackState, setFeedbackState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("Creating project…");

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const languageMap = useMemo(() => {
    return new Map<string, EnhancedLanguageOption>(
      COMMON_LANGUAGES.map((option) => {
        const compactLabel = option.label.replace(/\s*\(.*?\)\s*/g, "").trim();
        return [option.code, { ...option, compactLabel }];
      }),
    );
  }, []);

  const projectFieldMap = useMemo(() => {
    return new Map<string, (typeof PROJECT_FIELDS)[number]>(PROJECT_FIELDS.map((option) => [option.value, option]));
  }, []);

  const filteredSourceOptions = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase();
    if (query.length === 0) return COMMON_LANGUAGES;
    return COMMON_LANGUAGES.filter((option) => {
      const haystack = `${option.label} ${option.code}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [sourceSearch]);

  const filteredTargetOptions = useMemo(() => {
    const query = targetSearch.trim().toLowerCase();
    if (query.length === 0) return COMMON_LANGUAGES;
    return COMMON_LANGUAGES.filter((option) => {
      const haystack = `${option.label} ${option.code}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [targetSearch]);

  const toggleTargetLanguage = useCallback((code: string) => {
    setTargetLanguages((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }, []);

  const removeTargetLanguage = useCallback((code: string) => {
    setTargetLanguages((current) => current.filter((value) => value !== code));
  }, []);

  const renderLanguageLabel = useCallback(
    (code: string) => {
      const option = languageMap.get(code);
      if (!option) return code;
      return (
        <>
          {option.flag ? (
            <span aria-hidden="true" className="wizard-v2-option-flag">
              {option.flag}
            </span>
          ) : null}
          <span className="wizard-v2-option-text">
            <span className="wizard-v2-option-primary">{option.compactLabel || option.label}</span>
            <span className="wizard-v2-option-secondary">{option.code}</span>
          </span>
        </>
      );
    },
    [languageMap],
  );

  const renderLanguageChipLabel = useCallback(
    (code: string) => {
      return (
        <span className="wizard-v2-chip-text">
          {code.toUpperCase()}
        </span>
      );
    },
    [],
  );

  const renderSimpleLabel = useCallback(
    (value: string, lookup: Map<string, { label: string }>) => {
      if (!value) return null;
      const option = lookup.get(value);
      return option?.label ?? null;
    },
    [],
  );

  const deriveFileExtension = useCallback((file: File) => {
    const name = file.name ?? "";
    if (name.includes(".")) {
      const ext = name.split(".").pop();
      if (ext && ext.length > 0) {
        return ext.toUpperCase();
      }
    }
    if (file.type && file.type.includes("/")) {
      const ext = file.type.split("/").pop();
      if (ext && ext.length > 0) {
        return ext.toUpperCase();
      }
    }
    return "—";
  }, []);

  const inferDefaultRole = useCallback((file: File, extension: string): FileRoleValue => {
    if (file.type?.startsWith("image/")) {
      return "image";
    }
    if (["PNG", "JPG", "JPEG", "GIF", "BMP", "SVG", "WEBP", "TIFF"].includes(extension)) {
      return "image";
    }
    return "processable";
  }, []);

  const appendFiles = useCallback(
    (incoming: FileList | File[]) => {
      const fileArray = Array.from(incoming);
      if (fileArray.length === 0) return;

      setFiles((current) => {
        const additions = fileArray.map((file) => {
          fileIdRef.current += 1;
          const extension = deriveFileExtension(file);
          return {
            id: `file-${fileIdRef.current}`,
            name: file.name,
            extension,
            role: inferDefaultRole(file, extension),
          } satisfies DraftFileEntry;
        });
        return [...current, ...additions];
      });
    },
    [deriveFileExtension, inferDefaultRole],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files;
      if (!selected || selected.length === 0) {
        return;
      }
      appendFiles(selected);
      event.target.value = "";
    },
    [appendFiles],
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragEnter = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current += 1;
    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      setIsDragActive(true);
    }
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const droppedFiles = event.dataTransfer?.files;
      dragCounterRef.current = 0;
      setIsDragActive(false);
      setIsDragOver(false);

      if (droppedFiles && droppedFiles.length > 0) {
        appendFiles(droppedFiles);
      }
    },
    [appendFiles],
  );

  const handleDropZoneKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleBrowseClick();
      }
    },
    [handleBrowseClick],
  );

  const handleRoleChange = useCallback((id: string, role: FileRoleValue) => {
    setFiles((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, role } : entry)),
    );
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const fileCount = files.length;
  const finalizeTooltip = useMemo(() => {
    if (fileCount === 0) {
      return "Add at least one file to finalize the project once processing is enabled.";
    }
    return "File ingestion is still in progress. We'll enable this step soon.";
  }, [fileCount]);

  const simulateProgress = useCallback(
    (result: "success" | "error") => {
      if (feedbackState === "loading") return;
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
      setFeedbackState("loading");
      setFeedbackMessage("Creating project…");
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedbackState(result);
        setFeedbackMessage(
          result === "success"
            ? "Project created successfully."
            : "We couldn't create the project. Please review the inputs and try again.",
        );
        feedbackTimerRef.current = null;
      }, 900);
    },
    [feedbackState],
  );

  const dismissFeedback = useCallback(() => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedbackState("idle");
    setFeedbackMessage("Creating project…");
  }, []);

  const resetDragState = useCallback(() => {
    setIsDragActive(false);
    setIsDragOver(false);
    dragCounterRef.current = 0;
  }, []);

  const resetWizardStep = useCallback(() => {
    setStep("details");
    resetDragState();
  }, [resetDragState]);

  const resetWizardOnClose = useCallback(() => {
    resetWizardStep();
    dismissFeedback();
  }, [dismissFeedback, resetWizardStep]);

  const isNextEnabled = useMemo(() => {
    const hasName = projectName.trim().length > 0;
    const hasSource = Boolean(sourceLanguage);
    const hasTargets = targetLanguages.length > 0;
    const hasField = projectField.trim().length > 0;
    return hasName && hasSource && hasTargets && hasField;
  }, [projectField, projectName, sourceLanguage, targetLanguages]);

  const canClear = useMemo(() => {
    return (
      projectName.trim().length > 0 ||
      clientName.trim().length > 0 ||
      projectField.trim().length > 0 ||
      notes.trim().length > 0 ||
      sourceLanguage !== null ||
      targetLanguages.length > 0 ||
      sourceSearch.trim().length > 0 ||
      targetSearch.trim().length > 0 ||
      files.length > 0
    );
  }, [clientName, files.length, notes, projectField, projectName, sourceLanguage, sourceSearch, targetLanguages, targetSearch]);

  const handleClear = useCallback(() => {
    dismissFeedback();
    setProjectName("");
    setClientName("");
    setProjectField("");
    setNotes("");
    setSourceLanguage(null);
    setTargetLanguages([]);
    setSourceSearch("");
    setTargetSearch("");
    setSourceOpen(false);
    setTargetOpen(false);
    setFieldOpen(false);
    setFiles([]);
    fileIdRef.current = 0;
    resetDragState();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    resetWizardStep();
  }, [dismissFeedback, resetDragState, resetWizardStep]);

  const handleNext = useCallback(() => {
    if (!isNextEnabled) {
      return;
    }
    setStep("files");
  }, [isNextEnabled]);

  const handleBack = useCallback(() => {
    resetWizardStep();
  }, [resetWizardStep]);

  useEffect(() => {
    if (!open) {
      resetWizardOnClose();
    }
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
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
              <DialogClose
                type="button"
                className="wizard-v2-close"
                aria-label="Close wizard"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogClose>
            </div>
          </header>

          <form className="wizard-v2-form" aria-label="New project details">
            {step === "details" ? (
              <>
                <div className="wizard-v2-field">
                  <Label htmlFor="wizard-v2-project-name" className="wizard-v2-label">
                    Project name
                  </Label>
                  <Input
                    id="wizard-v2-project-name"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="e.g. Marketing localisation"
                    aria-required="true"
                    className={cn("wizard-v2-input", "wizard-v2-input--primary", "wizard-v2-control")}
                  />
                </div>

                <div className="wizard-v2-language-grid" role="group" aria-label="Language selection">
                  <section className="wizard-v2-language-panel" aria-labelledby="wizard-v2-source-label">
                    <div className="wizard-v2-language-header">
                      <Label id="wizard-v2-source-label" htmlFor="wizard-v2-source-language" className="wizard-v2-label">
                        Source language
                      </Label>
                    </div>
                    <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="wizard-v2-combobox-trigger wizard-v2-control"
                          id="wizard-v2-source-language"
                          aria-required="true"
                        >
                          <span className="wizard-v2-combobox-content">
                            {sourceLanguage ? (
                              <span className="wizard-v2-combobox-value">{renderLanguageLabel(sourceLanguage)}</span>
                            ) : (
                              <span className="wizard-v2-combobox-placeholder">Select a source language</span>
                            )}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="wizard-v2-combobox">
                        <div className="wizard-v2-combobox-search">
                          <Search className="wizard-v2-search-icon" aria-hidden="true" />
                          <Input
                            autoFocus
                            value={sourceSearch}
                            onChange={(event) => setSourceSearch(event.target.value)}
                            placeholder="Search languages…"
                            className="wizard-v2-search-input"
                          />
                        </div>
                        <div
                          role="listbox"
                          className="wizard-v2-option-list"
                          aria-label="Source language options"
                          onWheel={(event) => event.stopPropagation()}
                        >
                          {filteredSourceOptions.map((option) => {
                            const isSelected = option.code === sourceLanguage;
                            return (
                              <button
                                type="button"
                                key={option.code}
                                className={cn("wizard-v2-option", isSelected && "is-selected")}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setSourceLanguage(option.code);
                                  setSourceOpen(false);
                                }}
                              >
                                <span className="wizard-v2-option-main">{renderLanguageLabel(option.code)}</span>
                                {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </section>

                  <section className="wizard-v2-language-panel" aria-labelledby="wizard-v2-target-label">
                    <div className="wizard-v2-language-header">
                      <Label id="wizard-v2-target-label" htmlFor="wizard-v2-target-language-trigger" className="wizard-v2-label">
                        Target languages
                      </Label>
                      <span className="wizard-v2-language-count" aria-live="polite">
                        {targetLanguages.length}
                      </span>
                    </div>

                    <div className="wizard-v2-target-stack">
                      <Popover open={targetOpen} onOpenChange={setTargetOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            id="wizard-v2-target-language-trigger"
                            className="wizard-v2-combobox-trigger wizard-v2-combobox-trigger--ghost wizard-v2-control"
                            aria-required="true"
                          >
                            <span className="wizard-v2-combobox-content">
                              <Plus className="h-4 w-4" aria-hidden="true" />
                              <span>Add target languages</span>
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="wizard-v2-combobox">
                          <div className="wizard-v2-combobox-search">
                            <Search className="wizard-v2-search-icon" aria-hidden="true" />
                            <Input
                              autoFocus
                              value={targetSearch}
                              onChange={(event) => setTargetSearch(event.target.value)}
                              placeholder="Search languages…"
                              className="wizard-v2-search-input"
                            />
                          </div>
                          <div
                            role="listbox"
                            className="wizard-v2-option-list"
                            aria-label="Target language options"
                            onWheel={(event) => event.stopPropagation()}
                          >
                            {filteredTargetOptions.map((option) => {
                              const isSelected = targetLanguages.includes(option.code);
                              return (
                                <button
                                  type="button"
                                  key={option.code}
                                  className={cn("wizard-v2-option", isSelected && "is-selected")}
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => toggleTargetLanguage(option.code)}
                                >
                                  <span className="wizard-v2-option-main">{renderLanguageLabel(option.code)}</span>
                                  {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="wizard-v2-option-done"
                            onClick={() => setTargetOpen(false)}
                          >
                            Done
                          </button>
                        </PopoverContent>
                      </Popover>

                      <div className="wizard-v2-chip-scroll" role="presentation">
                        <div className="wizard-v2-chip-group" role="list">
                          {targetLanguages.length === 0 ? (
                            <span className="wizard-v2-chip-placeholder">No languages selected yet</span>
                          ) : null}
                          {targetLanguages.map((code) => (
                            <span key={code} className="wizard-v2-chip" role="listitem">
                              <span className="wizard-v2-chip-label">{renderLanguageChipLabel(code)}</span>
                              <button
                                type="button"
                                className="wizard-v2-chip-remove"
                                onClick={() => removeTargetLanguage(code)}
                                aria-label={`Remove ${code}`}
                              >
                                <X className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="wizard-v2-field-grid wizard-v2-field-grid--paired">
                  <div className="wizard-v2-field">
                    <Label htmlFor="wizard-v2-project-field" className="wizard-v2-label">
                      Project field
                    </Label>
                    <Popover open={fieldOpen} onOpenChange={setFieldOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          id="wizard-v2-project-field"
                          className="wizard-v2-combobox-trigger wizard-v2-combobox-trigger--compact wizard-v2-control"
                          aria-required="true"
                        >
                          <span className="wizard-v2-combobox-content">
                            {projectField ? (
                              <span className="wizard-v2-combobox-value">
                                {renderSimpleLabel(projectField, projectFieldMap)}
                              </span>
                            ) : (
                              <span className="wizard-v2-combobox-placeholder">Select specialisation</span>
                            )}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="wizard-v2-combobox wizard-v2-combobox--compact">
                        <div role="listbox" className="wizard-v2-option-list" aria-label="Project field options">
                          {PROJECT_FIELDS.map((option) => {
                            const isSelected = option.value === projectField;
                            return (
                              <button
                                type="button"
                                key={option.value}
                                className={cn("wizard-v2-option", "wizard-v2-option--tight", isSelected && "is-selected")}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setProjectField(option.value);
                                  setFieldOpen(false);
                                }}
                              >
                                <span className="wizard-v2-option-main">{option.label}</span>
                                {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="wizard-v2-field">
                    <Label htmlFor="wizard-v2-client" className="wizard-v2-label">
                      Client (optional)
                    </Label>
                    <Input
                      id="wizard-v2-client"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      placeholder="e.g. Acme Corp"
                      className={cn("wizard-v2-input", "wizard-v2-control")}
                    />
                  </div>
                </div>

                <div className="wizard-v2-field">
                  <Label htmlFor="wizard-v2-notes" className="wizard-v2-label">
                    Notes
                  </Label>
                  <Textarea
                    id="wizard-v2-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Additional context, deliverables, style notes…"
                    className="wizard-v2-textarea"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <section className="wizard-v2-files-step" aria-label="Project files configuration">
                <div
                  className={cn(
                    "wizard-v2-dropzone",
                    isDragActive && "is-active",
                    isDragOver && "is-over",
                  )}
                  onClick={handleBrowseClick}
                  onKeyDown={handleDropZoneKeyDown}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                >
                  <div className="wizard-v2-dropzone-icon">
                    <FileUp className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="wizard-v2-dropzone-copy">
                    <h3 className="wizard-v2-dropzone-title">Drag &amp; drop translation assets</h3>
                    <p className="wizard-v2-dropzone-subtitle">
                      or <span className="wizard-v2-dropzone-link">browse</span> to select files from your workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="wizard-v2-dropzone-browse"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleBrowseClick();
                    }}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>Browse files</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="wizard-v2-file-input"
                  onChange={handleFileInputChange}
                />
                {fileCount === 0 ? (
                  <div className="wizard-v2-files-empty" role="status">
                    <p className="wizard-v2-files-empty-title">No files queued yet</p>
                    <p className="wizard-v2-files-empty-copy">
                      Add source documents, reference packs, or guidance notes now so everything is ready when conversion opens up.
                    </p>
                  </div>
                ) : (
                  <div className="wizard-v2-file-table" role="region" aria-live="polite">
                    <header className="wizard-v2-file-table-header">
                      <span className="wizard-v2-file-count">
                        {fileCount} file{fileCount > 1 ? "s" : ""} queued
                      </span>
                    </header>
                    <div className="wizard-v2-file-table-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px] text-center">File n.</TableHead>
                            <TableHead className="w-[55%]">File name</TableHead>
                            <TableHead className="w-[100px]">File type</TableHead>
                            <TableHead className="w-[150px]">File role</TableHead>
                            <TableHead className="w-[60px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {files.map((entry, index) => (
                            <TableRow key={entry.id} className="wizard-v2-file-row">
                              <TableCell className="text-center font-medium text-foreground/80">
                                {index + 1}
                              </TableCell>
                              <TableCell className="wizard-v2-file-name">
                                {entry.name}
                              </TableCell>
                              <TableCell className="wizard-v2-file-type">
                                <Badge variant="outline" className="wizard-v2-type-badge">
                                  {entry.extension}
                                </Badge>
                              </TableCell>
                              <TableCell className="wizard-v2-file-role">
                                {entry.role === "image" ? (
                                  <Badge variant="outline" className="wizard-v2-role-badge">
                                    {FILE_ROLE_LABELS.image}
                                  </Badge>
                                ) : (
                                  <Select
                                    value={entry.role}
                                    onValueChange={(value) => handleRoleChange(entry.id, value as FileRoleValue)}
                                  >
                                    <SelectTrigger className="wizard-v2-role-trigger" aria-label={`Select role for ${entry.name}`}>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {EDITABLE_FILE_ROLE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell className="wizard-v2-file-actions">
                                <button
                                  type="button"
                                  className="wizard-v2-file-remove"
                                  onClick={() => handleRemoveFile(entry.id)}
                                  aria-label={`Remove ${entry.name}`}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                <div className="wizard-v2-feedback-test" role="group" aria-label="Project creation preview controls">
                  <div className="wizard-v2-feedback-test-label">
                    <span className="wizard-v2-feedback-dot" aria-hidden="true" />
                    <span>Preview creation feedback</span>
                  </div>
                  <div className="wizard-v2-feedback-test-actions">
                    <button
                      type="button"
                      className="wizard-v2-feedback-test-button"
                      onClick={() => simulateProgress("success")}
                    >
                      Simulate success
                    </button>
                    <button
                      type="button"
                      className="wizard-v2-feedback-test-button"
                      onClick={() => simulateProgress("error")}
                    >
                      Simulate failure
                    </button>
                    <button
                      type="button"
                      className="wizard-v2-feedback-test-button"
                      onClick={dismissFeedback}
                      disabled={feedbackState === "idle"}
                    >
                      Reset overlay
                    </button>
                  </div>
                </div>
              </section>
            )}

            <footer className="wizard-v2-actions">
              {step === "details" ? (
                <>
                  <button
                    type="button"
                    className="wizard-v2-action wizard-v2-action--clear"
                    onClick={handleClear}
                    disabled={!canClear}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>Clear</span>
                  </button>

                  {isNextEnabled ? (
                    <button
                      type="button"
                      className="wizard-v2-action wizard-v2-action--next"
                      onClick={handleNext}
                    >
                      <span>Next</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="wizard-v2-tooltip-anchor">
                          <button
                            type="button"
                            className="wizard-v2-action wizard-v2-action--next"
                            onClick={handleNext}
                            disabled
                            aria-disabled="true"
                          >
                            <span>Next</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent align="end">
                        Complete all required fields to continue.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="wizard-v2-action wizard-v2-action--back"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="wizard-v2-tooltip-anchor">
                        <button
                          type="button"
                          className="wizard-v2-action wizard-v2-action--next"
                          disabled
                          aria-disabled="true"
                        >
                          <span>Finalize</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent align="end">
                      {finalizeTooltip}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </footer>
          </form>

          {feedbackState !== "idle" ? (
            <div className="wizard-v2-feedback-overlay" role="status" aria-live="polite">
              <div
                className={cn("wizard-v2-feedback-card", feedbackState === "loading" && "is-loading")}
                data-state={feedbackState}
              >
                <div className="wizard-v2-feedback-icon" aria-hidden="true">
                  {feedbackState === "loading" ? <Loader2 className="h-8 w-8 animate-spin" /> : null}
                  {feedbackState === "success" ? <CheckCircle2 className="h-8 w-8" /> : null}
                  {feedbackState === "error" ? <XCircle className="h-8 w-8" /> : null}
                </div>
                <h3 className="wizard-v2-feedback-title">
                  {feedbackState === "loading"
                    ? "Creating project"
                    : feedbackState === "success"
                      ? "All set!"
                      : "Something went wrong"}
                </h3>
                <p className="wizard-v2-feedback-message">{feedbackMessage}</p>
                <div className="wizard-v2-feedback-actions">
                  <button
                    type="button"
                    className="wizard-v2-feedback-button"
                    onClick={dismissFeedback}
                  >
                    {feedbackState === "loading" ? "Cancel preview" : "Close"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
