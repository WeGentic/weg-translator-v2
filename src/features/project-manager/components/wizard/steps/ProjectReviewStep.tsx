import { useMemo } from "react";

import type { NewProjectForm } from "../types";
import { toFileDescriptor } from "../utils/file-descriptor";

interface ProjectReviewStepProps {
  form: NewProjectForm;
}

export function ProjectReviewStep({ form }: ProjectReviewStepProps) {
  const fileSummaries = useMemo(() => form.files.map(toFileDescriptor), [form.files]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/80 bg-muted/20 p-4">
        <dl className="grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Project name</dt>
            <dd className="text-right font-medium text-foreground">{form.name}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Project type</dt>
            <dd className="text-right font-medium text-foreground">{formatProjectType(form.type)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Files selected</dt>
            <dd className="text-right font-medium text-foreground">{fileSummaries.length}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Files to import</h3>
        <div className="max-h-48 overflow-y-auto rounded-md border border-border/60">
          {fileSummaries.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No files selected.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {fileSummaries.map((file) => (
                <li key={file.path} className="flex flex-col gap-1 p-3">
                  <span className="font-medium text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{file.directory}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function formatProjectType(type: NewProjectForm["type"]) {
  if (type === "translation") return "Translation";
  if (type === "rag") return "RAG";
  return "—";
}
