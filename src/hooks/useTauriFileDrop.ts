import { useCallback, useState, useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { PROJECT_FILE_EXTENSIONS_WITH_DOT } from "@/lib/file-formats";

export interface UseTauriFileDropOptions {
  onFilesDropped: (files: string[]) => void;
  acceptedFileTypes?: string[];
  multiple?: boolean;
  disabled?: boolean;
}

export interface UseTauriFileDropReturn {
  isDragActive: boolean;
  isDragOver: boolean;
}

const SUPPORTED_FILE_EXTENSIONS = PROJECT_FILE_EXTENSIONS_WITH_DOT;

/**
 * Hook for handling Tauri's global drag-drop events.
 * This should only be used ONCE per page/view to avoid duplicate file handling.
 */
export function useTauriFileDrop({
  onFilesDropped,
  acceptedFileTypes = SUPPORTED_FILE_EXTENSIONS,
  multiple = true,
  disabled = false,
}: UseTauriFileDropOptions): UseTauriFileDropReturn {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFileType = useCallback((fileName: string) => {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return acceptedFileTypes.some(type => type.toLowerCase() === extension);
  }, [acceptedFileTypes]);

  // Global Tauri drag-drop event listener
  useEffect(() => {
    if (disabled) return;

    let unlisten: (() => void) | null = null;

    const setupTauriListener = async () => {
      try {
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent((event) => {
          const { type, paths } = event.payload;

          switch (type) {
            case 'enter':
              setIsDragActive(true);
              break;

            case 'over':
              if (!isDragOver) {
                setIsDragOver(true);
              }
              break;

            case 'leave':
              setIsDragActive(false);
              setIsDragOver(false);
              break;

            case 'drop':
              if (paths && paths.length > 0) {
                // Filter files by type
                const validFiles = paths.filter(filePath => {
                  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
                  return validateFileType(fileName);
                });

                if (validFiles.length > 0) {
                  const filesToProcess = multiple ? validFiles : validFiles.slice(0, 1);
                  onFilesDropped(filesToProcess);
                }
              }

              setIsDragActive(false);
              setIsDragOver(false);
              break;

            case 'cancel':
              setIsDragActive(false);
              setIsDragOver(false);
              break;
          }
        });

      } catch (error) {
        console.warn('Failed to setup Tauri drag-drop listener:', error);
      }
    };

    void setupTauriListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [disabled, multiple, onFilesDropped, validateFileType, isDragOver]);

  return {
    isDragActive,
    isDragOver,
  };
}
