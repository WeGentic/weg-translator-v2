/**
 * @file Renders the second step of the project wizard (file queue management).
 */

import { useCallback, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { FileText, FileUp, Trash2 } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/class-names";

import { EDITABLE_FILE_ROLE_OPTIONS, FILE_ROLE_LABELS } from "../constants";
import type { DraftFileEntry, FileRoleValue } from "../types";

interface WizardFilesStepProps {
  files: DraftFileEntry[];
  fileCount: number;
  isDragActive: boolean;
  isDragOver: boolean;
  onBrowseClick: () => void;
  onDragEnter: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onRoleChange: (id: string, role: FileRoleValue) => void;
  onRemoveFile: (id: string) => void;
}

export function WizardFilesStep({
  files,
  fileCount,
  isDragActive,
  isDragOver,
  onBrowseClick,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onRoleChange,
  onRemoveFile,
}: WizardFilesStepProps) {
  const handleDropZoneKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onBrowseClick();
      }
    },
    [onBrowseClick],
  );

  return (
    <section className="wizard-v2-files-step" aria-label="Project files configuration">
      <div
        className={cn("wizard-v2-dropzone", isDragActive && "is-active", isDragOver && "is-over")}
        aria-describedby="wizard-v2-dropzone-hint"
        onClick={onBrowseClick}
        onKeyDown={handleDropZoneKeyDown}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <span className="wizard-v2-dropzone-glow" aria-hidden="true" />
        <div className="wizard-v2-dropzone-body">
          <div className="wizard-v2-dropzone-leadin">
            <div className="wizard-v2-dropzone-icon">
              <FileUp className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="wizard-v2-dropzone-copy">
              <h3 className="wizard-v2-dropzone-title">Drag &amp; drop translation assets</h3>
              <p className="wizard-v2-dropzone-subtitle">
                Drop multiple files at once or use the action to queue items from your workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="wizard-v2-dropzone-browse"
            onClick={(event) => {
              event.stopPropagation();
              onBrowseClick();
            }}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>Browse files</span>
          </button>
        </div>
        <p className="wizard-v2-dropzone-hint" id="wizard-v2-dropzone-hint">
          Tip: Press Enter or Space to browse. Dragging keeps the order of everything you drop.
        </p>
      </div>
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
                    <TableCell className="wizard-v2-file-name">{entry.name}</TableCell>
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
                        <Select value={entry.role} onValueChange={(value) => onRoleChange(entry.id, value as FileRoleValue)}>
                          <SelectTrigger
                            className="wizard-v2-role-trigger"
                            aria-label={`Select role for ${entry.name}`}
                          >
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
                        onClick={() => onRemoveFile(entry.id)}
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
    </section>
  );
}
