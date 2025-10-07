import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export interface UseTauriFileDropOptions {
  onFilesDropped: (files: string[]) => void;
  acceptedFileTypes?: readonly string[];
  multiple?: boolean;
  disabled?: boolean;
}

export interface UseTauriFileDropReturn {
  isDragActive: boolean;
  isDragOver: boolean;
}

/**
 * Hook for handling Tauri's global drag-drop events.
 * This should only be used ONCE per page/view to avoid duplicate file handling.
 */
export function useTauriFileDrop({
  onFilesDropped,
  acceptedFileTypes,
  multiple = true,
  disabled = false,
}: UseTauriFileDropOptions): UseTauriFileDropReturn {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const normalizedExtensions = useMemo(() => {
    if (!acceptedFileTypes || acceptedFileTypes.length === 0) {
      return null;
    }
    return acceptedFileTypes.map((type) =>
      type.startsWith('.') ? type.toLowerCase() : `.${type.toLowerCase()}`,
    );
  }, [acceptedFileTypes]);

  const validateFileType = useCallback((fileName: string) => {
    if (normalizedExtensions == null) {
      return true;
    }
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return false;
    }
    const extension = fileName.slice(lastDotIndex).toLowerCase();
    return normalizedExtensions.includes(extension);
  }, [normalizedExtensions]);

  // Global Tauri drag-drop event listener
  useEffect(() => {
    if (disabled) return;

    let unlisten: (() => void) | null = null;

    const setupTauriListener = async () => {
      try {
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent((event) => {
          const { type } = event.payload;

          switch (type) {
            case "enter":
              setIsDragActive(true);
              break;

            case "over":
              if (!isDragOver) {
                setIsDragOver(true);
              }
              break;

            case "leave":
              setIsDragActive(false);
              setIsDragOver(false);
              break;

            case "drop": {
              const { paths } = event.payload;
              if (paths && paths.length > 0) {
                // Filter files by type
                const validFiles = paths.filter((filePath) => {
                  const fileName = filePath.split("/").pop() || filePath.split("\\").pop() || "";
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
            }
          }
        });

      } catch (error) {
        console.warn("Failed to setup Tauri drag-drop listener:", error);
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
