import { Clock, TimerReset } from "lucide-react";

import { DashboardCard } from "../../../primitives";
import type { DashboardTimeInsight } from "../../../../data/dashboard.types";

import "./TimeCard.css";

export interface TimeCardProps {
  time: DashboardTimeInsight;
  lastRefreshedAt: Date | null;
  className?: string;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}m tracked today`;
  }
  if (remainingMinutes === 0) {
    return `${hours}h recorded today`;
  }
  return `${hours}h ${remainingMinutes}m recorded today`;
}

function formatAbsoluteTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatLastRefreshed(lastRefreshedAt: Date | null) {
  if (!lastRefreshedAt) return "Not refreshed yet";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(lastRefreshedAt);
}

export function TimeCard({ time, lastRefreshedAt, className }: TimeCardProps) {
  return (
    <DashboardCard
      id="dashboard-card-time"
      title="Time insight"
      description="Workspace clock and sync cadence"
      bodyClassName="dashboard-time-card"
      className={className}
    >
      <div className="dashboard-time-card__primary">
        <Clock className="h-10 w-10" aria-hidden="true" />
        <div>
          <p className="dashboard-time-card__time">{time.localTime}</p>
          <p className="dashboard-time-card__timezone">{time.timezone}</p>
          <p className="dashboard-time-card__offset">UTC offset {time.utcOffset}</p>
        </div>
      </div>

      <dl className="dashboard-time-card__meta">
        <div>
          <dt>Next sync</dt>
          <dd>{formatAbsoluteTime(time.nextSyncAt)}</dd>
        </div>
        <div>
          <dt>Manual refresh</dt>
          <dd>{formatLastRefreshed(lastRefreshedAt)}</dd>
        </div>
      </dl>

      <div className="dashboard-time-card__summary">
        <TimerReset className="h-4 w-4" aria-hidden="true" />
        <span>{formatDuration(time.dailyTranslationMinutes)}</span>
      </div>
    </DashboardCard>
  );
}
