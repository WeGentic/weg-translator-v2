import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isWellFormedBcp47 } from "@/lib/validators";

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
        <Select value={form.type} onValueChange={(value) => onChange({ type: value as NewProjectForm["type"] })}>
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
          <Input
            id="src-lang"
            value={form.srcLang}
            onChange={(e) => onChange({ srcLang: e.target.value })}
            placeholder="e.g. en-US"
            aria-invalid={Boolean(errors.srcLang) || (form.srcLang ? !isWellFormedBcp47(form.srcLang) : false)}
            aria-describedby={errors.srcLang ? "src-lang-error" : undefined}
          />
          {errors.srcLang ? (
            <p id="src-lang-error" className="text-xs text-destructive">
              {errors.srcLang}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tgt-lang" className="flex items-center justify-between text-sm font-medium text-foreground">
            Target language
            <span className="text-xs font-normal text-muted-foreground">BCP‑47</span>
          </Label>
          <Input
            id="tgt-lang"
            value={form.tgtLang}
            onChange={(e) => onChange({ tgtLang: e.target.value })}
            placeholder="e.g. it-IT"
            aria-invalid={Boolean(errors.tgtLang) || (form.tgtLang ? !isWellFormedBcp47(form.tgtLang) : false)}
            aria-describedby={errors.tgtLang ? "tgt-lang-error" : undefined}
          />
          {errors.tgtLang ? (
            <p id="tgt-lang-error" className="text-xs text-destructive">
              {errors.tgtLang}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
