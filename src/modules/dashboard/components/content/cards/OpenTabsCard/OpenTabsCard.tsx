import { CircleDot } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { DashboardCard } from "../../../primitives";
import type { DashboardOpenTab, DashboardTabStatus } from "../../../../data/dashboard.types";

import "./OpenTabsCard.css";

export interface OpenTabsCardProps {
  tabs: DashboardOpenTab[];
  className?: string;
}

const STATUS_LABELS: Record<DashboardTabStatus, string> = {
  active: "Active",
  idle: "Idle",
  "awaiting-review": "Awaiting review",
  completed: "Completed",
};

function formatUpdatedAt(updatedAt: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(updatedAt));
  } catch {
    return updatedAt;
  }
}

export function OpenTabsCard({ tabs, className }: OpenTabsCardProps) {
  return (
    <DashboardCard
      id="dashboard-card-open-tabs"
      title="Open translation tabs"
      description="Quick access to in-flight documents"
      bodyClassName="dashboard-open-tabs-card"
      className={className}
      actions={
        <button type="button" className="dashboard-card__link" aria-label="Manage open tabs">
          Manage
        </button>
      }
    >
      {tabs.length === 0 ? (
        <div className="dashboard-open-tabs-card__empty" role="status">
          <p>No tabs are currently open.</p>
        </div>
      ) : (
        <ul className="dashboard-open-tabs-card__list">
          {tabs.map((tab) => (
            <li key={tab.id} className="dashboard-open-tabs-card__item">
              <div className="dashboard-open-tabs-card__row">
                <div>
                  <p className="dashboard-open-tabs-card__document">{tab.documentName}</p>
                  <p className="dashboard-open-tabs-card__meta">
                    {tab.projectName} • {tab.languagePair}
                  </p>
                </div>
                <Badge variant="secondary">{STATUS_LABELS[tab.status]}</Badge>
              </div>
              <div className="dashboard-open-tabs-card__footer">
                <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                <time dateTime={tab.updatedAt}>
                  Updated {formatUpdatedAt(tab.updatedAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
