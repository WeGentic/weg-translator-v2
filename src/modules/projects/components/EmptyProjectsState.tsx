// features/projects/components/EmptyProjectsState.tsx
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";

import "./EmptyProjectsState.css";

export function EmptyProjectsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-projects-state">
      <div
        className="empty-projects-state__content"
        role="group"
        aria-labelledby="empty-projects-state-heading"
      >
        <div className="empty-projects-state__icon-wrapper" aria-hidden="true">
          <span className="empty-projects-state__icon-halo" />
          <span className="empty-projects-state__icon-frame">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="empty-projects-state__icon"
            >
              <path
                d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M12 10v6m-3-3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        </div>

        <div className="empty-projects-state__text">
          <h3 id="empty-projects-state-heading" className="empty-projects-state__heading">
            No projects yet
          </h3>
          <p className="empty-projects-state__description">
            Kick-start your workspace by creating a project to organise files, run translations, and
            track progress in one place.
          </p>
        </div>

        <Button type="button" size="lg" onClick={onCreate} className="empty-projects-state__cta">
          <Plus className="empty-projects-state__cta-icon" aria-hidden="true" />
          Create your first project
        </Button>
      </div>
    </div>
  );
}
