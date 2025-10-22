/**
 * @file Manages the list of files queued in the wizard before submission.
 *
 * Encapsulating file operations inside a hook keeps the main component focused
 * on orchestration while providing an intuitive API for manipulating the queue.
 */

import { useCallback, useRef, useState } from "react";

import type { DraftFileEntry, FileRoleValue } from "../types";
import { extractFileExtension, extractFileName, inferDefaultRoleFromExtension } from "../utils";

interface UseWizardFilesOptions {
  initialFiles?: DraftFileEntry[];
}

interface UseWizardFilesReturn {
  files: DraftFileEntry[];
  fileCount: number;
  appendPaths: (incoming: readonly string[]) => void;
  updateFileRole: (id: string, role: FileRoleValue) => void;
  removeFile: (id: string) => void;
  resetFiles: (next?: DraftFileEntry[]) => void;
}

export function useWizardFiles(options?: UseWizardFilesOptions): UseWizardFilesReturn {
  const fileIdRef = useRef(0);

  const [files, setFiles] = useState<DraftFileEntry[]>(() => {
    if (!options?.initialFiles || options.initialFiles.length === 0) {
      return [];
    }
    const sanitized = sanitizeInitialFiles(options.initialFiles);
    if (sanitized.length === 0) {
      return [];
    }
    fileIdRef.current = determineMaxFileId(sanitized);
    return sanitized;
  });

  const appendPaths = useCallback((incoming: readonly string[]) => {
    if (!incoming || incoming.length === 0) {
      return;
    }

    setFiles((current) => {
      const existingPaths = new Set(current.map((entry) => entry.path));
      const additions: DraftFileEntry[] = [];

      for (const rawPath of incoming) {
        if (typeof rawPath !== "string") {
          continue;
        }
        const normalizedPath = rawPath.trim();
        if (normalizedPath.length === 0 || existingPaths.has(normalizedPath)) {
          continue;
        }

        fileIdRef.current += 1;
        const name = extractFileName(normalizedPath);
        const extension = extractFileExtension(name);
        const role = inferDefaultRoleFromExtension(extension);

        additions.push({
          id: `file-${fileIdRef.current}`,
          name,
          extension,
          role,
          path: normalizedPath,
        });
        existingPaths.add(normalizedPath);
      }

      if (additions.length === 0) {
        return current;
      }

      return [...current, ...additions];
    });
  }, []);

  const updateFileRole = useCallback((id: string, role: FileRoleValue) => {
    setFiles((current) => current.map((entry) => (entry.id === id ? { ...entry, role } : entry)));
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const resetFiles = useCallback((next?: DraftFileEntry[]) => {
    if (next && next.length > 0) {
      const sanitized = sanitizeInitialFiles(next);
      fileIdRef.current = determineMaxFileId(sanitized);
      setFiles(sanitized);
      return;
    }

    fileIdRef.current = 0;
    setFiles([]);
  }, []);

  return {
    files,
    fileCount: files.length,
    appendPaths,
    updateFileRole,
    removeFile,
    resetFiles,
  };
}

function sanitizeInitialFiles(entries: DraftFileEntry[]): DraftFileEntry[] {
  const sanitized: DraftFileEntry[] = [];
  const seenPaths = new Set<string>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const id = typeof entry.id === "string" && entry.id.trim().length > 0 ? entry.id : null;
    const path = typeof entry.path === "string" ? entry.path.trim() : "";
    const role = entry.role;

    if (!id || path.length === 0 || !isValidRole(role)) {
      continue;
    }

    if (seenPaths.has(path)) {
      continue;
    }

    sanitized.push({
      id,
      name: typeof entry.name === "string" ? entry.name : extractFileName(path),
      extension: typeof entry.extension === "string" ? entry.extension : extractFileExtension(path),
      role,
      path,
    });

    seenPaths.add(path);
  }

  return sanitized;
}

function isValidRole(value: unknown): value is FileRoleValue {
  return (
    value === "undefined" ||
    value === "processable" ||
    value === "reference" ||
    value === "instructions" ||
    value === "image" ||
    value === "ocr"
  );
}

const FILE_ID_PATTERN = /file-(\d+)$/;

function determineMaxFileId(entries: readonly DraftFileEntry[]): number {
  return entries.reduce((currentMax, entry) => {
    const match = FILE_ID_PATTERN.exec(entry.id);
    if (!match) {
      return currentMax;
    }
    const numeric = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(numeric) && numeric > currentMax) {
      return numeric;
    }
    return currentMax;
  }, 0);
}
