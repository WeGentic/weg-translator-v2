import { useMemo, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { isWellFormedBcp47 } from "@/shared/utils/validation";
import { COMMON_LANGUAGES, isKnownLanguage } from "../utils/languages";
import { ArrowLeftRight } from "lucide-react";

import type { NewProjectForm, ProjectFormErrors } from "../types";

const projectTypeOptions = [
  { value: "translation", label: "Translation" },
  { value: "rag", label: "RAG" },
] as const;

interface ProjectDetailsStepProps {
  form: NewProjectForm;
  errors: ProjectFormErrors;
  onChange: (patch: Partial<NewProjectForm>) => void;
}

export function ProjectDetailsStep({ form, errors, onChange }: ProjectDetailsStepProps) {
  const [srcCustom, setSrcCustom] = useState(() => !isKnownLanguage(form.srcLang));
  const [tgtCustom, setTgtCustom] = useState(() => !isKnownLanguage(form.tgtLang));

  const srcInvalid = Boolean(errors.srcLang) || (form.srcLang ? !isWellFormedBcp47(form.srcLang) : false);
  const tgtInvalid = Boolean(errors.tgtLang) || (form.tgtLang ? !isWellFormedBcp47(form.tgtLang) : false);

  const selectPlaceholder = { src: "Select source language", tgt: "Select target language" } as const;

  const orderedLanguages = useMemo(() => {
    const preferred = new Set(["en-US", "it-IT"]);
    const head = COMMON_LANGUAGES.filter((l) => preferred.has(l.code));
    const tail = COMMON_LANGUAGES.filter((l) => !preferred.has(l.code));
    return [...head, ...tail];
  }, []);

  const swapLanguages = () => {
    onChange({ srcLang: form.tgtLang, tgtLang: form.srcLang });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="project-name" className="flex items-center justify-between text-sm font-medium text-foreground">
          Project name
          <span className="text-xs font-normal text-muted-foreground">Required</span>
        </Label>
        <Input
          id="project-name"
          autoFocus
          value={form.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="e.g. Marketing localisation"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "project-name-error" : undefined}
        />
        {errors.name ? (
          <p id="project-name-error" className="text-xs text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="project-type"
          className="flex items-center justify-between text-sm font-medium text-foreground"
        >
          Project type
          <span className="text-xs font-normal text-muted-foreground">Required</span>
        </Label>
        <Select value={form.type} onValueChange={(value) => onChange({ type: value })}>
          <SelectTrigger
            id="project-type"
            aria-invalid={Boolean(errors.type)}
            aria-describedby={errors.type ? "project-type-error" : undefined}
          >
            <SelectValue placeholder="Select project type" />
          </SelectTrigger>
          <SelectContent>
            {projectTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type ? (
          <p id="project-type-error" className="text-xs text-destructive">
            {errors.type}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="src-lang" className="flex items-center justify-between text-sm font-medium text-foreground">
            Source language
            <span className="text-xs font-normal text-muted-foreground">BCP‑47</span>
          </Label>
          {srcCustom ? (
            <Input
              id="src-lang"
              value={form.srcLang}
              onChange={(e) => onChange({ srcLang: e.target.value })}
              placeholder="e.g. en-US"
              aria-invalid={srcInvalid}
              aria-describedby={errors.srcLang ? "src-lang-error" : undefined}
            />
          ) : (
            <Select
              value={isKnownLanguage(form.srcLang) ? form.srcLang : undefined}
              onValueChange={(value) => {
                onChange({ srcLang: value });
              }}
            >
              <SelectTrigger
                id="src-lang"
                aria-invalid={srcInvalid}
                aria-describedby={errors.srcLang ? "src-lang-error" : undefined}
              >
                <SelectValue placeholder={selectPlaceholder.src} />
              </SelectTrigger>
              <SelectContent>
                {orderedLanguages.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base leading-none" aria-hidden="true">{opt.flag ?? ""}</span>
                      <span>{opt.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center justify-between">
            {errors.srcLang ? (
              <p id="src-lang-error" className="text-xs text-destructive">
                {errors.srcLang}
              </p>
            ) : <span />}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSrcCustom((v) => !v)}
            >
              {srcCustom ? "Back to list" : "Use custom tag"}
            </Button>
          </div>
        </div>

        <div className="flex items-end justify-center pb-1 sm:pt-6">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={swapLanguages}
            aria-label="Swap languages"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tgt-lang" className="flex items-center justify-between text-sm font-medium text-foreground">
            Target language
            <span className="text-xs font-normal text-muted-foreground">BCP‑47</span>
          </Label>
          {tgtCustom ? (
            <Input
              id="tgt-lang"
              value={form.tgtLang}
              onChange={(e) => onChange({ tgtLang: e.target.value })}
              placeholder="e.g. it-IT"
              aria-invalid={tgtInvalid}
              aria-describedby={errors.tgtLang ? "tgt-lang-error" : undefined}
            />
          ) : (
            <Select
              value={isKnownLanguage(form.tgtLang) ? form.tgtLang : undefined}
              onValueChange={(value) => {
                onChange({ tgtLang: value });
              }}
            >
              <SelectTrigger
                id="tgt-lang"
                aria-invalid={tgtInvalid}
                aria-describedby={errors.tgtLang ? "tgt-lang-error" : undefined}
              >
                <SelectValue placeholder={selectPlaceholder.tgt} />
              </SelectTrigger>
              <SelectContent>
                {orderedLanguages.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base leading-none" aria-hidden="true">{opt.flag ?? ""}</span>
                      <span>{opt.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center justify-between">
            {errors.tgtLang ? (
              <p id="tgt-lang-error" className="text-xs text-destructive">
                {errors.tgtLang}
              </p>
            ) : <span />}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTgtCustom((v) => !v)}
            >
              {tgtCustom ? "Back to list" : "Use custom tag"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
