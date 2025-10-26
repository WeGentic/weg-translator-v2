/**
 * @file Renders the second step of the project wizard (file queue management).
 */

import { useCallback, useMemo, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { LuFilePlus2 } from "react-icons/lu";
import { LuFileMinus2 } from "react-icons/lu";



import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/class-names";

import { EDITABLE_FILE_ROLE_OPTIONS, FILE_ROLE_LABELS, IMAGE_EXTENSIONS } from "../constants";
import type { AssignableFileRoleValue, DraftFileEntry, FileRoleValue } from "../types";

type FileTypeVariant = "document" | "spreadsheet" | "presentation" | "image" | "archive" | "media" | "code" | "other";

const TYPE_VARIANT_CLASS_MAP: Record<FileTypeVariant, string> = {
  document: "wizard-project-manager-type-badge--document",
  spreadsheet: "wizard-project-manager-type-badge--spreadsheet",
  presentation: "wizard-project-manager-type-badge--presentation",
  image: "wizard-project-manager-type-badge--image",
  archive: "wizard-project-manager-type-badge--archive",
  media: "wizard-project-manager-type-badge--media",
  code: "wizard-project-manager-type-badge--code",
  other: "wizard-project-manager-type-badge--other",
};

const ROLE_VARIANT_CLASS_MAP: Record<FileRoleValue, string> = {
  undefined: "wizard-project-manager-role-variant--undefined",
  processable: "wizard-project-manager-role-variant--processable",
  reference: "wizard-project-manager-role-variant--reference",
  instructions: "wizard-project-manager-role-variant--instructions",
  image: "wizard-project-manager-role-variant--image",
  ocr: "wizard-project-manager-role-variant--ocr",
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

    const orderedRoles: FileRoleValue[] = ["undefined", "processable", "reference", "instructions", "ocr", "image"];
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
    <section className="wizard-project-manager-files-step" aria-label="Project files configuration">
      <div
        className={cn("wizard-project-manager-dropzone", isDragActive && "is-active", isDragOver && "is-over")}
        aria-describedby="wizard-project-manager-dropzone-hint"
        onClick={onBrowseClick}
        onKeyDown={handleDropZoneKeyDown}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <span className="wizard-project-manager-dropzone-glow" aria-hidden="true" />
        <div className="wizard-project-manager-dropzone-body">
          <div className="wizard-project-manager-dropzone-icon" aria-hidden="true">
            <LuFilePlus2 className="h-12 w-12" />
          </div>
          <div className="wizard-project-manager-dropzone-copy">
            <h3 className="wizard-project-manager-dropzone-title">Drop project files</h3>
            <p className="wizard-project-manager-dropzone-subtitle">Drag documents here or click to browse to pick from your device.</p>
          </div>
          
        </div>
        
      </div>
      {fileCount === 0 ? (
        <div className="wizard-project-manager-files-empty" role="status">
          <p className="wizard-project-manager-files-empty-title">No files queued yet</p>
          <p className="wizard-project-manager-files-empty-copy">
            Add source documents, reference packs, or guidance notes now so everything is ready when conversion opens up.
          </p>
        </div>
      ) : (
        <div className="wizard-project-manager-file-table" role="region" aria-live="polite">
          <header className="wizard-project-manager-file-table-header">
            <span className="wizard-project-manager-file-count">
              {fileCount} file{fileCount > 1 ? "s" : ""} queued
            </span>
            {fileRoleSummary !== "" ? (
              <span className="wizard-project-manager-file-role-summary" aria-label="Files grouped by role">
                {fileRoleSummary}
              </span>
            ) : null}
          </header>
          <div className="wizard-project-manager-file-table-scroll">
            <Table>
              <TableHeader className="text-(--color-victorian-peacock-950)">
                <TableRow>
                  <TableHead className="w-[130px] text-center">File n.</TableHead>
                  <TableHead className="w-[50%]">File name</TableHead>
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
                  const normalizedExtension = extensionLabel.trim();
                  const eligibleRoleOptions = EDITABLE_FILE_ROLE_OPTIONS.filter((option) => {
                    if (!option.isEligible) {
                      return true;
                    }
                    return option.isEligible(normalizedExtension);
                  });
                  const selectableOptions: Array<{ value: AssignableFileRoleValue; label: string }> = eligibleRoleOptions.map(
                    ({ value, label }) => ({
                      value,
                      label,
                    }),
                  );
                  if (
                    entry.role !== "undefined" &&
                    !selectableOptions.some((option) => option.value === entry.role)
                  ) {
                    selectableOptions.push({ value: entry.role, label: FILE_ROLE_LABELS[entry.role] });
                  }

                  return (
                    <TableRow key={entry.id} className="wizard-project-manager-file-row">
                      <TableCell className="text-center font-medium text-foreground/80">
                        {index + 1}
                      </TableCell>
                      <TableCell className="wizard-project-manager-file-name" title={entry.name}>
                        <span>{entry.name}</span>
                      </TableCell>
                      <TableCell className="wizard-project-manager-file-type">
                        <Badge variant="outline" className={cn("wizard-project-manager-type-badge", fileTypeClass)}>
                          {extensionLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="wizard-project-manager-file-role">
                        <Select
                          value={entry.role === "undefined" ? undefined : entry.role}
                          onValueChange={(value) => onRoleChange(entry.id, value as FileRoleValue)}
                        >
                          <SelectTrigger
                            className={cn("wizard-project-manager-role-trigger", roleVariantClass)}
                            aria-label={`Select role for ${entry.name}`}
                            data-role-state={entry.role}
                          >
                            <SelectValue placeholder={FILE_ROLE_LABELS.undefined} />
                          </SelectTrigger>
                          <SelectContent className="wizard-project-manager-role-menu mt-2">
                            {selectableOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="wizard-project-manager-role-item">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="wizard-project-manager-file-actions">
                        <button
                          type="button"
                          className="wizard-project-manager-file-remove"
                          onClick={() => onRemoveFile(entry.id)}
                          aria-label={`Remove ${entry.name}`}
                        >
                          <LuFileMinus2 className="h-5 w-5 text-(--color-destructive)" aria-hidden="true" />
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
