import { Folder, X } from "lucide-react";
import { useCallback, useMemo } from "react";

import { ensureProjectName } from "@/modules/projects/events";

import "./css/sidebar-two-focused-project.css";

export interface FocusedProjectShortcutProps {
  projectId: string;
  projectName?: string;
  isOpening?: boolean;
  onOpen?: (projectId: string) => void;
  onDismiss?: () => void;
}

export function FocusedProjectShortcut({
  projectId,
  projectName,
  isOpening = false,
  onOpen,
  onDismiss,
}: FocusedProjectShortcutProps) {
  const safeName = useMemo(() => ensureProjectName(projectName), [projectName]);

  const handleOpen = useCallback(() => {
    if (isOpening) {
      return;
    }
    onOpen?.(projectId);
  }, [isOpening, onOpen, projectId]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  return (
    <div className="sidebar-two-focused-project" role="group" aria-label="Selected project">
      <div className="sidebar-two-focused-project__group">
        <span className="sidebar-two-focused-project__indicator" aria-hidden="true" />
        <button
          type="button"
          className="sidebar-two-focused-project__main"
          onClick={handleOpen}
          aria-label={`Open ${safeName}`}
          disabled={isOpening}
        >
          <Folder className="sidebar-two-focused-project__icon" aria-hidden="true" />
          <span className="sidebar-two-focused-project__label" title={safeName}>
            {safeName}
          </span>
        </button>
        <button
          type="button"
          className="sidebar-two-focused-project__close"
          onClick={handleDismiss}
          aria-label="Close project view"
        >
          <X className="sidebar-two-focused-project__close-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
