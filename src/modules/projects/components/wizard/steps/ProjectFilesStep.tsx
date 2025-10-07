import { useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import type { NewProjectForm, ProjectFormErrors } from "../types";
import { ALLOWED_EXTENSIONS } from "../types";
import { toFileDescriptor } from "../utils/file-descriptor";

interface ProjectFilesStepProps {
  files: NewProjectForm["files"];
  errors: ProjectFormErrors;
  onFilesChange: (files: string[]) => void;
}

export function ProjectFilesStep({ files, errors, onFilesChange }: ProjectFilesStepProps) {
  const rows = useMemo(() => files.map(toFileDescriptor), [files]);

  async function handleAddFiles() {
    const selection = await open({
      multiple: true,
      filters: [
        {
          name: "Supported",
          extensions: [...ALLOWED_EXTENSIONS],
        },
      ],
    });

    if (!selection) return;

    const selected = Array.isArray(selection) ? selection : [selection];
    if (selected.length === 0) return;

    const merged = [...files];
    for (const file of selected) {
      if (!merged.includes(file)) {
        merged.push(file);
      }
    }
    onFilesChange(merged);
  }

  function handleRemoveFile(path: string) {
    onFilesChange(files.filter((file) => file !== path));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Project files</h3>
          <p className="text-xs text-muted-foreground">
            Add documents to import into the project. You can remove files before creating the project.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleAddFiles()}
          className="w-full sm:w-auto"
        >
          Add files
        </Button>
      </div>

      <div className="rounded-md border border-border/80">
        {rows.length === 0 ? (
          <div className="flex h-28 flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <p>No files selected yet.</p>
            <p className="text-xs">Click “Add files” to choose documents.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead className="w-[55%]">File name</TableHead>
                <TableHead className="hidden w-[35%] text-muted-foreground sm:table-cell">Location</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((file) => (
                <TableRow key={file.path} className="border-border/60">
                  <TableCell>{file.name}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {file.directory}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(file.path)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {errors.files ? <p className="text-xs text-destructive">{errors.files}</p> : null}
    </div>
  );
}
