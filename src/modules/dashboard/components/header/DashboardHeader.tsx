import type {
  DashboardClientSnapshot,
  DashboardTimeInsight,
} from "../../data/dashboard.types";

import "./dashboard-header.css";

export interface DashboardHeaderProps {
  client: DashboardClientSnapshot;
  time: DashboardTimeInsight;
  unreadEmailCount: number;
  activeProjectCount: number;
}

function deriveGreeting(hour: number) {
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }

  return "Welcome back";
}

function formatTimeLabel({ localTime, timezone }: DashboardTimeInsight) {
  return `${localTime} • ${timezone}`;
}

function formatNextSync(nextSyncAt: string) {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return formatter.format(new Date(nextSyncAt));
  } catch {
    return nextSyncAt;
  }
}

export function DashboardHeader({
  client,
  time,
  unreadEmailCount,
  activeProjectCount,
}: DashboardHeaderProps) {
  const greeting = deriveGreeting(new Date().getHours());

  return (
    <div className="dashboard-header">
      <header className="dashboard-header__shell" aria-labelledby="dashboard-heading">
        <div className="dashboard-header__intro">
          <p className="dashboard-header__greeting">{greeting}</p>
          <h1 id="dashboard-heading" className="dashboard-header__title">
            {client.name} overview
          </h1>
          <p className="dashboard-header__subtitle">
            {client.industry} • Managed by {client.accountManager}
          </p>
        </div>

        <dl className="dashboard-header__meta" aria-label="Dashboard quick stats">
          <div className="dashboard-header__meta-item">
            <dt className="dashboard-header__meta-label">Local time</dt>
            <dd className="dashboard-header__meta-value">{formatTimeLabel(time)}</dd>
          </div>
          <div className="dashboard-header__meta-item">
            <dt className="dashboard-header__meta-label">Next sync</dt>
            <dd className="dashboard-header__meta-value">{formatNextSync(time.nextSyncAt)}</dd>
          </div>
          <div className="dashboard-header__meta-item">
            <dt className="dashboard-header__meta-label">Unread emails</dt>
            <dd className="dashboard-header__meta-value">{unreadEmailCount}</dd>
          </div>
          <div className="dashboard-header__meta-item">
            <dt className="dashboard-header__meta-label">Active projects</dt>
            <dd className="dashboard-header__meta-value">{activeProjectCount}</dd>
          </div>
        </dl>
      </header>
      <div className="dashboard-header__divider" aria-hidden="true" />
    </div>
  );
}
