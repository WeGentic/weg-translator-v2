/**
 * @file Renders the first step of the project wizard (project details).
 *
 * The component focuses purely on UI concerns while exposing change handlers
 * to the parent. Transient UI state (search input, popover visibility) lives
 * here so that clearing the wizard simply remounts the step.
 */

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { PiUserList } from "react-icons/pi";

import { COMMON_LANGUAGES } from "@/modules/project-manager/config";
import type { EnhancedLanguageOption } from "../types";
import { createLanguageMap } from "../utils";
import { cn } from "@/shared/utils/class-names";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Textarea } from "@/shared/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { ClientRecord } from "@/shared/types/database";

import { WizardClientField } from "@/modules/wizards/shared";
import { PROJECT_SUBJECT_OPTIONS, resolveProjectSubjectLabel } from "@/modules/project-manager/constants";

interface WizardDetailsStepProps {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  clientName: string;
  onClientNameChange: (value: string) => void;
  clientOptions: ClientRecord[];
  clientLoading: boolean;
  clientErrorMessage: string | null;
  selectedClientUuid: string | null;
  onClientSelect: (client: ClientRecord | null) => void;
  onRequestClientCreate: (initialName: string) => void;
  onRequestClientTable: () => void;
  projectField: string;
  onProjectFieldChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  sourceLanguage: string | null;
  onSourceLanguageSelect: (value: string) => void;
  targetLanguages: string[];
  onToggleTargetLanguage: (value: string) => void;
  onRemoveTargetLanguage: (value: string) => void;
}

export function WizardDetailsStep({
  projectName,
  onProjectNameChange,
  clientName,
  onClientNameChange,
  clientOptions,
  clientLoading,
  clientErrorMessage,
  selectedClientUuid,
  onClientSelect,
  onRequestClientCreate,
  onRequestClientTable,
  projectField,
  onProjectFieldChange,
  notes,
  onNotesChange,
  sourceLanguage,
  onSourceLanguageSelect,
  targetLanguages,
  onToggleTargetLanguage,
  onRemoveTargetLanguage,
}: WizardDetailsStepProps) {
  const languageMap = useMemo<Map<string, EnhancedLanguageOption>>(() => {
    return createLanguageMap(COMMON_LANGUAGES);
  }, []);

  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);

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

  const renderLanguageLabel = useCallback(
    (code: string) => {
      const option = languageMap.get(code);
      if (!option) return code;
      return (
        <>
          {option.flag ? (
            <span aria-hidden="true" className="wizard-project-manager-option-flag">
              {option.flag}
            </span>
          ) : null}
          <span className="wizard-project-manager-option-text">
            <span className="wizard-project-manager-option-primary">{option.compactLabel || option.label}</span>
            <span className="wizard-project-manager-option-secondary">{option.code}</span>
          </span>
        </>
      );
    },
    [languageMap],
  );

  const renderLanguageChipLabel = useCallback((code: string) => {
    return <span className="wizard-project-manager-chip-text">{code.toUpperCase()}</span>;
  }, []);

  const renderProjectFieldLabel = useCallback((value: string) => {
    return resolveProjectSubjectLabel(value);
  }, []);

  const handleClientValueChange = useCallback(
    (value: string) => {
      onClientNameChange(value);
    },
    [onClientNameChange],
  );

  const handleClientSelect = useCallback(
    (client: ClientRecord) => {
      onClientSelect(client);
      onClientNameChange(client.name);
    },
    [onClientNameChange, onClientSelect],
  );

  const handleClientCreateRequest = useCallback(
    (initialName: string) => {
      onRequestClientCreate(initialName);
    },
    [onRequestClientCreate],
  );

  return (
    <>
      <div className="wizard-project-manager-field">
        <Label htmlFor="wizard-project-manager-project-name" className="wizard-project-manager-label">
          Project name
        </Label>
        <Input
          id="wizard-project-manager-project-name"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          placeholder="Provide a name for your project"
          aria-required="true"
          className="wizard-input-field"
        />
      </div>

      <div className="wizard-project-manager-language-grid" role="group" aria-label="Language selection">
        <section className="wizard-project-manager-language-panel" aria-labelledby="wizard-project-manager-source-label">
          <div className="wizard-project-manager-language-header pt-[2.5px] h-[1.5rem]">
            <Label id="wizard-project-manager-source-label" 
              htmlFor="wizard-project-manager-source-language"
              className="wizard-project-manager-label mb-2">
              Source language
            </Label>
          </div>
          <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="wizard-project-manager-combobox-trigger wizard-project-manager-control"
                id="wizard-project-manager-source-language"
                aria-required="true"
              >
                <span className="wizard-project-manager-combobox-content">
                  {sourceLanguage ? (
                    <span className="wizard-project-manager-combobox-value">{renderLanguageLabel(sourceLanguage)}</span>
                  ) : (
                    <span className="wizard-project-manager-combobox-placeholder">Select a source language</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="wizard-project-manager-combobox">
              <div className="wizard-project-manager-combobox-search">
                <Search className="wizard-project-manager-search-icon" aria-hidden="true" />
                <Input
                  autoFocus
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.target.value)}
                  placeholder="Search languages…"
                  className="wizard-project-manager-search-input-language"
                />
              </div>
              <div
                role="listbox"
                className="wizard-project-manager-option-list"
                aria-label="Source language options"
                onWheel={(event) => event.stopPropagation()}
              >
                {filteredSourceOptions.map((option) => {
                  const isSelected = option.code === sourceLanguage;
                  return (
                    <button
                      type="button"
                      key={option.code}
                      className={cn("wizard-project-manager-option", isSelected && "is-selected")}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSourceLanguageSelect(option.code);
                        setSourceOpen(false);
                      }}
                    >
                      <span className="wizard-project-manager-option-main">{renderLanguageLabel(option.code)}</span>
                      {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </section>

        <section className="wizard-project-manager-language-panel" aria-labelledby="wizard-project-manager-target-label">
          <div className="wizard-project-manager-language-header pt-[2.5px] h-[1.5rem]">
            <Label id="wizard-project-manager-target-label" 
              htmlFor="wizard-project-manager-target-language-trigger"
              className="wizard-project-manager-label">
              Target languages
            </Label>
            <span className="wizard-project-manager-language-count" aria-live="polite">
              {targetLanguages.length}
            </span>
          </div>

          <div className="wizard-project-manager-target-stack">
            <Popover open={targetOpen} onOpenChange={setTargetOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="wizard-project-manager-target-language-trigger"
                  className="wizard-project-manager-combobox-trigger wizard-project-manager-combobox-trigger--ghost wizard-project-manager-control"
                  aria-required="true"
                >
                  <span className="wizard-project-manager-combobox-content">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add target languages</span>
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="wizard-project-manager-combobox">
                <div className="wizard-project-manager-combobox-search">
                  <Search className="wizard-project-manager-search-icon" aria-hidden="true" />
                  <Input
                    autoFocus
                    value={targetSearch}
                    onChange={(event) => setTargetSearch(event.target.value)}
                    placeholder="Search languages…"
                    className="wizard-project-manager-search-input-language"
                  />
                </div>
                <div
                  role="listbox"
                  className="wizard-project-manager-option-list"
                  aria-label="Target language options"
                  onWheel={(event) => event.stopPropagation()}
                >
                  {filteredTargetOptions.map((option) => {
                    const isSelected = targetLanguages.includes(option.code);
                    return (
                      <button
                        type="button"
                        key={option.code}
                        className={cn("wizard-project-manager-option", isSelected && "is-selected")}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => onToggleTargetLanguage(option.code)}
                      >
                        <span className="wizard-project-manager-option-main">{renderLanguageLabel(option.code)}</span>
                        {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="wizard-project-manager-option-done" onClick={() => setTargetOpen(false)}>
                  Done
                </button>
              </PopoverContent>
            </Popover>

            <div className="wizard-project-manager-chip-scroll" role="presentation">
              <div className="wizard-project-manager-chip-group" role="list">
                {targetLanguages.length === 0 ? (
                  <span className="wizard-project-manager-chip-placeholder">No languages selected yet</span>
                ) : null}
                {targetLanguages.map((code) => (
                  <span key={code} className="wizard-project-manager-chip" role="listitem">
                    <span className="wizard-project-manager-chip-label">{renderLanguageChipLabel(code)}</span>
                    <button
                      type="button"
                      className="wizard-project-manager-chip-remove"
                      onClick={() => onRemoveTargetLanguage(code)}
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

      <div className="wizard-project-manager-field-grid wizard-project-manager-field-grid--paired">
        <div className="wizard-project-manager-field">
          <div className="wizard-project-manager-label-row pt-[3.5px] h-[2rem]">
            <Label htmlFor="wizard-project-manager-project-field" className="wizard-project-manager-label">
              Subject
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="wizard-project-manager-icon-button" aria-label="Add project field">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                Add new subject
              </TooltipContent>
            </Tooltip>
          </div>
          <Popover open={fieldOpen} onOpenChange={setFieldOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                id="wizard-project-manager-project-field"
                className="wizard-project-manager-combobox-trigger wizard-project-manager-combobox-trigger--compact wizard-project-manager-control"
                aria-required="true"
              >
                <span className="wizard-project-manager-combobox-content">
                  {projectField ? (
                    <span className="wizard-project-manager-combobox-value">{renderProjectFieldLabel(projectField)}</span>
                  ) : (
                    <span className="wizard-project-manager-combobox-placeholder">Select specialisation</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="wizard-project-manager-combobox wizard-project-manager-combobox--compact">
              <div role="listbox" className="wizard-project-manager-option-list" aria-label="Project field options">
                {PROJECT_SUBJECT_OPTIONS.map((option) => {
                  const isSelected = option.value === projectField;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      className={cn("wizard-project-manager-option", "wizard-project-manager-option--tight", isSelected && "is-selected")}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onProjectFieldChange(option.value);
                        setFieldOpen(false);
                      }}
                    >
                      <span className="wizard-project-manager-option-main">{option.label}</span>
                      {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="wizard-project-manager-field">
          <div className="wizard-project-manager-label-row pt-[3.5px] h-[2rem]">
            <Label htmlFor="wizard-project-manager-client" className="wizard-project-manager-label">
              Client (optional)
            </Label>
            <div className="wizard-project-manager-label-actions">
              <Tooltip>
                <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRequestClientTable}
                aria-haspopup="dialog"
                aria-label="Open client manager"
                className="wizard-project-manager-icon-button"
              >
                <PiUserList />
              </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                  Show Client manager
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="wizard-project-manager-icon-button"
                    aria-label="Add client"
                    onClick={() => handleClientCreateRequest(clientName.trim())}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Add new client
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <WizardClientField
            inputId="wizard-project-manager-client"
            value={clientName}
            options={clientOptions}
            onValueChange={handleClientValueChange}
            onSelect={handleClientSelect}
            onResetSelection={() => onClientSelect(null)}
            onCreateRequested={handleClientCreateRequest}
            selectedClientUuid={selectedClientUuid}
            isLoading={clientLoading}
            errorMessage={clientErrorMessage}
          />
        </div>
      </div>

      <div className="wizard-project-manager-field">
        <Label htmlFor="wizard-project-manager-notes" className="wizard-project-manager-label">
          Notes
        </Label>
        <Textarea
          id="wizard-project-manager-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Additional context, deliverables, style notes…"
          className="wizard-project-manager-textarea"
          rows={3}
        />
      </div>
    </>
  );
}
