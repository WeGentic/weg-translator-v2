/**
 * @file Provides event handlers and state for the dropzone interaction.
 *
 * The hook abstracts both browser drag events and the additional Tauri drag
 * payloads so that the UI layer can remain declarative and testable.
 */

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { DragDropEventPayload, FileWithPath } from "../types";

interface UseWizardDropzoneParams {
  onPathsCaptured: (paths: readonly string[]) => void;
  onDropError: (message: string) => void;
}

interface UseWizardDropzoneReturn {
  isDragActive: boolean;
  isDragOver: boolean;
  handleDragEnter: (event: ReactDragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: ReactDragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  handleDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  resetDragState: () => void;
}

const DROP_ERROR_MESSAGE =
  "We couldn't access the file paths from this drop. Please use the Browse files action instead.";

export function useWizardDropzone({ onPathsCaptured, onDropError }: UseWizardDropzoneParams): UseWizardDropzoneReturn {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const dragDropPathsRef = useRef<string[]>([]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    void (async () => {
      try {
        unlisten = await listen<DragDropEventPayload>("tauri://drag-drop", (event) => {
          const payload = event.payload;
          if (!payload) {
            return;
          }

          if (payload.type === "drop") {
            dragDropPathsRef.current = Array.isArray(payload.paths) ? payload.paths : [];
          }

          if (payload.type === "leave" || payload.type === "cancelled") {
            dragDropPathsRef.current = [];
          }
        });
      } catch (error) {
        if (!cancelled) {
          console.warn("[wizard-v2] Failed to register drag-drop listener", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      dragDropPathsRef.current = [];
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleDragEnter = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current += 1;
    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      setIsDragActive(true);
    }
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      dragCounterRef.current = 0;
      setIsDragActive(false);
      setIsDragOver(false);

      const capturedPaths = dragDropPathsRef.current;
      dragDropPathsRef.current = [];

      if (capturedPaths.length > 0) {
        onPathsCaptured(capturedPaths);
        return;
      }

      const fallbackFiles = event.dataTransfer?.files;
      if (fallbackFiles && fallbackFiles.length > 0) {
        const fallbackPaths: string[] = [];
        for (const file of Array.from(fallbackFiles)) {
          const candidate = (file as FileWithPath).path;
          if (candidate && candidate.trim().length > 0) {
            fallbackPaths.push(candidate);
          }
        }
        if (fallbackPaths.length > 0) {
          onPathsCaptured(fallbackPaths);
          return;
        }
      }

      onDropError(DROP_ERROR_MESSAGE);
    },
    [onDropError, onPathsCaptured],
  );

  const resetDragState = useCallback(() => {
    setIsDragActive(false);
    setIsDragOver(false);
    dragCounterRef.current = 0;
    dragDropPathsRef.current = [];
  }, []);

  return {
    isDragActive,
    isDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    resetDragState,
  };
}
