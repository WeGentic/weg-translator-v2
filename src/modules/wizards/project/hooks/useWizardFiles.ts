/**
 * @file Manages the list of files queued in the wizard before submission.
 *
 * Encapsulating file operations inside a hook keeps the main component focused
 * on orchestration while providing an intuitive API for manipulating the queue.
 */

import { useCallback, useRef, useState } from "react";

import type { DraftFileEntry, FileRoleValue } from "../types";
import { extractFileExtension, extractFileName, inferDefaultRoleFromExtension } from "../utils";

interface UseWizardFilesReturn {
  files: DraftFileEntry[];
  fileCount: number;
  appendPaths: (incoming: readonly string[]) => void;
  updateFileRole: (id: string, role: FileRoleValue) => void;
  removeFile: (id: string) => void;
  resetFiles: () => void;
}

export function useWizardFiles(): UseWizardFilesReturn {
  const [files, setFiles] = useState<DraftFileEntry[]>([]);
  const fileIdRef = useRef(0);

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

  const resetFiles = useCallback(() => {
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
