import { useCallback, useRef, useState, useMemo } from "react";

export interface UseFileDropOptions {
  disabled?: boolean;
  // Drag state is now passed in from parent
  isDragActive?: boolean;
  isDragOver?: boolean;
}

export interface UseFileDropReturn {
  isDragOver: boolean;
  isDragActive: boolean;
  dragProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  getRootProps: () => {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Hook for HTML5 drag events - provides visual feedback only.
 * File handling should be done by useTauriFileDrop at a higher level.
 */
export function useFileDrop({
  disabled = false,
  isDragActive: externalDragActive = false,
  isDragOver: externalDragOver = false,
}: UseFileDropOptions): UseFileDropReturn {
  const [localIsDragOver, setLocalIsDragOver] = useState(false);
  const [localIsDragActive, setLocalIsDragActive] = useState(false);
  const dragCounter = useRef(0);

  // Use external state if provided, otherwise use local state
  const isDragActive = externalDragActive || localIsDragActive;
  const isDragOver = externalDragOver || localIsDragOver;

  // HTML5 drag events - used for visual feedback and preventing defaults

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    dragCounter.current++;

    // Only set local state if no external state is provided
    if (!externalDragActive && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setLocalIsDragActive(true);
    }
  }, [disabled, externalDragActive]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    dragCounter.current--;

    // Only update local state if no external state is provided
    if (!externalDragActive && !externalDragOver && dragCounter.current === 0) {
      setLocalIsDragActive(false);
      setLocalIsDragOver(false);
    }
  }, [disabled, externalDragActive, externalDragOver]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // Only set local state if no external state is provided
    if (!externalDragOver && !localIsDragOver) {
      setLocalIsDragOver(true);
    }

    // Set dropEffect to indicate this is a valid drop target
    e.dataTransfer.dropEffect = "copy";
  }, [disabled, externalDragOver, localIsDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // Reset local state
    setLocalIsDragActive(false);
    setLocalIsDragOver(false);
    dragCounter.current = 0;

    // File handling is now done by useTauriFileDrop at a higher level
  }, [disabled]);

  const dragProps = useMemo(() => ({
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  }), [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const getRootProps = useCallback(() => dragProps, [dragProps]);

  return {
    isDragOver,
    isDragActive,
    dragProps,
    getRootProps,
  };
}