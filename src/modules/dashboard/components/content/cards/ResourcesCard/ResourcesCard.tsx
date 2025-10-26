import { ExternalLink, FileText } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { DashboardCard } from "../../../primitives";
import type { DashboardResourceLink } from "../../../../data/dashboard.types";

import "./ResourcesCard.css";

export interface ResourcesCardProps {
  resources: DashboardResourceLink[];
  className?: string;
}

const CATEGORY_LABELS: Record<DashboardResourceLink["category"], string> = {
  documentation: "Documentation",
  guidelines: "Guidelines",
  reporting: "Reporting",
  support: "Support",
};

export function ResourcesCard({ resources, className }: ResourcesCardProps) {
  return (
    <DashboardCard
      id="dashboard-card-resources"
      title="Resources & playbooks"
      description="Keep reference material within reach"
      actions={
        <button type="button" className="dashboard-card__link" aria-label="Manage resources">
          Manage
        </button>
      }
      bodyClassName="dashboard-resources-card"
      className={className}
    >
      {resources.length === 0 ? (
        <div className="dashboard-resources-card__empty" role="status">
          <p>No resources are pinned yet.</p>
        </div>
      ) : (
        <ul className="dashboard-resources-card__list">
          {resources.map((resource) => (
            <li key={resource.id} className="dashboard-resources-card__item">
              <div className="dashboard-resources-card__meta">
                <Badge variant="outline">{CATEGORY_LABELS[resource.category]}</Badge>
                {resource.external ? (
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </div>
              <a
                href={resource.href}
                className="dashboard-resources-card__link"
                target={resource.external ? "_blank" : undefined}
                rel={resource.external ? "noreferrer" : undefined}
              >
                <span className="dashboard-resources-card__title">{resource.label}</span>
                <span className="dashboard-resources-card__description">{resource.description}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
