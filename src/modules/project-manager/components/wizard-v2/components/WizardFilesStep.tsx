/**
 * @file Renders the second step of the project wizard (file queue management).
 */

import { useCallback, useMemo, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { FileText, FileUp, Trash2 } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/class-names";

import { EDITABLE_FILE_ROLE_OPTIONS, FILE_ROLE_LABELS, IMAGE_EXTENSIONS } from "../constants";
import type { DraftFileEntry, FileRoleValue } from "../types";

type FileTypeVariant = "document" | "spreadsheet" | "presentation" | "image" | "archive" | "media" | "code" | "other";

const TYPE_VARIANT_CLASS_MAP: Record<FileTypeVariant, string> = {
  document: "wizard-v2-type-badge--document",
  spreadsheet: "wizard-v2-type-badge--spreadsheet",
  presentation: "wizard-v2-type-badge--presentation",
  image: "wizard-v2-type-badge--image",
  archive: "wizard-v2-type-badge--archive",
  media: "wizard-v2-type-badge--media",
  code: "wizard-v2-type-badge--code",
  other: "wizard-v2-type-badge--other",
};

const ROLE_VARIANT_CLASS_MAP: Record<FileRoleValue, string> = {
  processable: "wizard-v2-role-variant--processable",
  reference: "wizard-v2-role-variant--reference",
  instructions: "wizard-v2-role-variant--instructions",
  image: "wizard-v2-role-variant--image",
};

const DOCUMENT_EXTENSIONS = new Set(["DOC", "DOCX", "PDF", "TXT", "RTF", "ODT", "MD"]);
const SPREADSHEET_EXTENSIONS = new Set(["XLS", "XLSX", "CSV", "ODS"]);
const PRESENTATION_EXTENSIONS = new Set(["PPT", "PPTX", "KEY", "ODP"]);
const ARCHIVE_EXTENSIONS = new Set(["ZIP", "RAR", "7Z", "TAR", "GZ", "TGZ"]);
const MEDIA_EXTENSIONS = new Set(["MP3", "WAV", "MP4", "MOV", "AVI", "MKV", "FLAC", "OGG"]);
const CODE_EXTENSIONS = new Set(["XML", "JSON", "HTML", "JS", "TS", "TSX", "CSS", "YAML", "YML"]);

function resolveFileTypeVariant(extension: string): FileTypeVariant {
  const normalized = extension.trim().toUpperCase();

  if (normalized.length === 0) {
    return "other";
  }

  if (IMAGE_EXTENSIONS.has(normalized)) {
    return "image";
  }

  if (DOCUMENT_EXTENSIONS.has(normalized)) {
    return "document";
  }

  if (SPREADSHEET_EXTENSIONS.has(normalized)) {
    return "spreadsheet";
  }

  if (PRESENTATION_EXTENSIONS.has(normalized)) {
    return "presentation";
  }

  if (MEDIA_EXTENSIONS.has(normalized)) {
    return "media";
  }

  if (ARCHIVE_EXTENSIONS.has(normalized)) {
    return "archive";
  }

  if (CODE_EXTENSIONS.has(normalized)) {
    return "code";
  }

  return "other";
}

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

  const fileRoleSummary = useMemo(() => {
    if (files.length === 0) {
      return "";
    }

    const counts: Partial<Record<FileRoleValue, number>> = files.reduce((accumulator, entry) => {
      accumulator[entry.role] = (accumulator[entry.role] ?? 0) + 1;
      return accumulator;
    }, {} as Partial<Record<FileRoleValue, number>>);

    const orderedRoles: FileRoleValue[] = ["processable", "reference", "instructions", "image"];
    const parts = orderedRoles
      .map((role) => {
        const count = counts[role];
        if (!count) {
          return null;
        }

        return `${FILE_ROLE_LABELS[role]}: ${count}`;
      })
      .filter((part): part is string => part !== null);

    return parts.join(" · ");
  }, [files]);

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
          <div className="wizard-v2-dropzone-icon" aria-hidden="true">
            <FileUp className="h-6 w-6" />
          </div>
          <div className="wizard-v2-dropzone-copy">
            <h3 className="wizard-v2-dropzone-title">Drop project files</h3>
            <p className="wizard-v2-dropzone-subtitle">Drag documents here or browse to pick from your device.</p>
          </div>
          <div className="wizard-v2-dropzone-actions">
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
        </div>
        <p className="wizard-v2-dropzone-hint" id="wizard-v2-dropzone-hint">
          Tip: Press Enter or Space to browse. Dropped files keep their order.
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
            {fileRoleSummary !== "" ? (
              <span className="wizard-v2-file-role-summary" aria-label="Files grouped by role">
                {fileRoleSummary}
              </span>
            ) : null}
          </header>
          <div className="wizard-v2-file-table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] text-center">File n.</TableHead>
                  <TableHead className="w-[55%]">File name</TableHead>
                  <TableHead className="w-[130px]">File type</TableHead>
                  <TableHead className="w-[150px]">File role</TableHead>
                  <TableHead className="w-[60px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((entry, index) => {
                  const extensionLabel = entry.extension.toUpperCase();
                  const fileTypeClass = TYPE_VARIANT_CLASS_MAP[resolveFileTypeVariant(extensionLabel)];
                  const roleVariantClass = ROLE_VARIANT_CLASS_MAP[entry.role];

                  return (
                    <TableRow key={entry.id} className="wizard-v2-file-row">
                      <TableCell className="text-center font-medium text-foreground/80">
                        {index + 1}
                      </TableCell>
                      <TableCell className="wizard-v2-file-name" title={entry.name}>
                        <span>{entry.name}</span>
                      </TableCell>
                      <TableCell className="wizard-v2-file-type">
                        <Badge variant="outline" className={cn("wizard-v2-type-badge", fileTypeClass)}>
                          {extensionLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="wizard-v2-file-role">
                        {entry.role === "image" ? (
                          <Badge variant="outline" className={cn("wizard-v2-role-badge", roleVariantClass)}>
                            {FILE_ROLE_LABELS.image}
                          </Badge>
                        ) : (
                          <Select value={entry.role} onValueChange={(value) => onRoleChange(entry.id, value as FileRoleValue)}>
                            <SelectTrigger
                              className={cn("wizard-v2-role-trigger", roleVariantClass)}
                              aria-label={`Select role for ${entry.name}`}
                            >
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent className="wizard-v2-role-menu">
                              {EDITABLE_FILE_ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value} className="wizard-v2-role-item">
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
