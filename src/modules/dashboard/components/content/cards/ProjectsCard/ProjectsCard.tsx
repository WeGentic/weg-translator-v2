import { TrendingUp } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Progress } from "@/shared/ui/progress";
import { DashboardCard } from "../../../primitives";
import type {
  DashboardProjectSummary,
  DashboardProjectStatus,
  DashboardStatusFilter,
} from "../../../../data/dashboard.types";

import "./ProjectsCard.css";

export interface ProjectsCardProps {
  projects: DashboardProjectSummary[];
  statusFilter: DashboardStatusFilter;
  className?: string;
}

const STATUS_LABELS: Record<DashboardProjectStatus, string> = {
  planning: "Planning",
  "in-progress": "In progress",
  review: "Review",
  blocked: "Blocked",
  delivered: "Delivered",
};

function formatDueDate(dueDate: string) {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    });
    return formatter.format(new Date(dueDate));
  } catch {
    return dueDate;
  }
}

export function ProjectsCard({ projects, statusFilter, className }: ProjectsCardProps) {
  const filteredLabel = statusFilter === "all" ? "All statuses" : STATUS_LABELS[statusFilter];

  return (
    <DashboardCard
      id="dashboard-card-projects"
      title="Projects in motion"
      description={`Tracking ${projects.length} active items (${filteredLabel})`}
      actions={
        <button type="button" className="dashboard-card__link" aria-label="Open projects workspace">
          View all projects
        </button>
      }
      bodyClassName="dashboard-projects-card"
      className={className}
    >
      {projects.length === 0 ? (
        <div className="dashboard-projects-card__empty" role="status">
          <p>No projects match the current filters.</p>
        </div>
      ) : (
        <ul className="dashboard-projects-card__list">
          {projects.map((project) => (
            <li key={project.id} className="dashboard-projects-card__item">
              <div className="dashboard-projects-card__row">
                <div>
                  <p className="dashboard-projects-card__name">{project.name}</p>
                  <p className="dashboard-projects-card__meta">
                    {project.languagePair} • Due {formatDueDate(project.dueDate)}
                  </p>
                </div>
                <Badge variant="outline" className="dashboard-projects-card__status">
                  {STATUS_LABELS[project.status]}
                </Badge>
              </div>
              <div className="dashboard-projects-card__progress">
                <Progress value={project.progress} aria-label={`${project.name} progress`} />
                <span className="dashboard-projects-card__progress-value">{project.progress}%</span>
              </div>
              <div className="dashboard-projects-card__footer">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{project.owner}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
