import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { NewProjectForm, ProjectFormErrors } from "./types";

const projectTypeOptions = [
  { value: "translation", label: "Translation" },
  { value: "rag", label: "RAG" },
] as const;

interface CreateProjectDetailsProps {
  form: NewProjectForm;
  errors: ProjectFormErrors;
  onChange: (patch: Partial<NewProjectForm>) => void;
}

export function CreateProjectDetails({ form, errors, onChange }: CreateProjectDetailsProps) {
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
        <Select
          value={form.type}
          onValueChange={(value) => onChange({ type: value as NewProjectForm["type"] })}
        >
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
    </div>
  );
}
