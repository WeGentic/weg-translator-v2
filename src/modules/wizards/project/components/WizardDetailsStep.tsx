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

  const renderLanguageChipLabel = useCallback((code: string) => {
    return <span className="wizard-v2-chip-text">{code.toUpperCase()}</span>;
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
      <div className="wizard-v2-field">
        <Label htmlFor="wizard-v2-project-name" className="wizard-v2-label">
          Project name
        </Label>
        <Input
          id="wizard-v2-project-name"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          placeholder="Provide a name for your project"
          aria-required="true"
          className="wizard-input-field"
        />
      </div>

      <div className="wizard-v2-language-grid" role="group" aria-label="Language selection">
        <section className="wizard-v2-language-panel" aria-labelledby="wizard-v2-source-label">
          <div className="wizard-v2-language-header pt-[2.5px]">
            <Label id="wizard-v2-source-label" 
              htmlFor="wizard-v2-source-language"
              className="wizard-v2-label mb-2">
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
                        onSourceLanguageSelect(option.code);
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
            <Label id="wizard-v2-target-label" 
              htmlFor="wizard-v2-target-language-trigger"
              className="wizard-v2-label">
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
                        onClick={() => onToggleTargetLanguage(option.code)}
                      >
                        <span className="wizard-v2-option-main">{renderLanguageLabel(option.code)}</span>
                        {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="wizard-v2-option-done" onClick={() => setTargetOpen(false)}>
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

      <div className="wizard-v2-field-grid wizard-v2-field-grid--paired">
        <div className="wizard-v2-field">
          <div className="wizard-v2-label-row">
            <Label htmlFor="wizard-v2-project-field" className="wizard-v2-label">
              Subject
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="wizard-v2-icon-button" aria-label="Add project field">
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
                id="wizard-v2-project-field"
                className="wizard-v2-combobox-trigger wizard-v2-combobox-trigger--compact wizard-v2-control"
                aria-required="true"
              >
                <span className="wizard-v2-combobox-content">
                  {projectField ? (
                    <span className="wizard-v2-combobox-value">{renderProjectFieldLabel(projectField)}</span>
                  ) : (
                    <span className="wizard-v2-combobox-placeholder">Select specialisation</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="wizard-v2-combobox wizard-v2-combobox--compact">
              <div role="listbox" className="wizard-v2-option-list" aria-label="Project field options">
                {PROJECT_SUBJECT_OPTIONS.map((option) => {
                  const isSelected = option.value === projectField;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      className={cn("wizard-v2-option", "wizard-v2-option--tight", isSelected && "is-selected")}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onProjectFieldChange(option.value);
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
          <div className="wizard-v2-label-row">
            <Label htmlFor="wizard-v2-client" className="wizard-v2-label">
              Client (optional)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="wizard-v2-icon-button"
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
          <WizardClientField
            inputId="wizard-v2-client"
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

      <div className="wizard-v2-field">
        <Label htmlFor="wizard-v2-notes" className="wizard-v2-label">
          Notes
        </Label>
        <Textarea
          id="wizard-v2-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Additional context, deliverables, style notes…"
          className="wizard-v2-textarea"
          rows={3}
        />
      </div>
    </>
  );
}
