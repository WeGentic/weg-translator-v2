import "./css/ProjectViewHeader.css";

import { X } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import type { ProjectListItem } from "@/core/ipc";
import { formatProjectCreated, formatProjectUpdated } from "./utils/project-dates";

export interface ProjectViewHeaderProps {
  headingId?: string;
  summary: ProjectListItem;
  subjectLine: string;
  onClose?: () => void;
}

export function ProjectViewHeader({
  headingId = "ProjectView-heading",
  summary,
  subjectLine,
  onClose,
}: ProjectViewHeaderProps) {
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "projects" } }));
  }, [onClose]);

  const statusLabel = summary.status ? summary.status.toUpperCase() : "UNKNOWN";
  const createdAt = formatProjectCreated(summary.createdAt);
  const updatedAt = formatProjectUpdated(summary.updatedAt);
  const clientLabel = summary.clientName?.trim() ?? "Unassigned";
  const subjectLabel = subjectLine.trim().length > 0 ? subjectLine : "Not specified yet";

  return (
    <>
      <header className="project-view-header" aria-labelledby={headingId} role="banner">
        <div className="project-view-header__row">
          <div className="project-view-header__col project-view-header__col--title" aria-live="polite">
            <h1 className="project-view-header__title" id={headingId} title={summary.name}>
              {summary.name}
            </h1>
            <Badge variant="secondary" className="project-view-header__status-badge">
              {statusLabel}
            </Badge>
          </div>

          <div className="project-view-header__col project-view-header__col--meta">
            <div className="project-view-header__meta-row project-view-header__meta-row--timestamps">
              <span title={updatedAt.absolute}>Updated {updatedAt.relative}</span>
              <span aria-hidden="true" className="project-view-header__separator">
                •
              </span>
              <span>Created {createdAt}</span>
            </div>
            <div className="project-view-header__meta-row project-view-header__meta-row--associations">
              <span>
                Client: <strong title={clientLabel}>{clientLabel}</strong>
              </span>
              <span aria-hidden="true" className="project-view-header__separator">
                •
              </span>
              <span>Subject: <strong title={subjectLabel}>{subjectLabel}</strong></span>
            </div>
          </div>

          <div className="project-view-header__col project-view-header__col--actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="project-view-header__close"
              onClick={handleClose}
              aria-label="Close project"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <div className="sidebar-one__logo-divider" aria-hidden="true" />
    </>
  );
}

export default ProjectViewHeader;
