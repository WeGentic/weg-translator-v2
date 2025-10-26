import { useState } from "react";

import { dashboardMockSnapshot } from "../data/dashboard.mocks";
import type { DashboardStatusFilter } from "../data/dashboard.types";
import { DashboardHeader } from "../components/header/DashboardHeader";
import { DashboardToolbar } from "../components/toolbar/DashboardToolbar";
import { DashboardContent } from "../components/content/DashboardContent";
import "@/shared/styles/main-view.css";

export function DashboardView() {
  const snapshot = dashboardMockSnapshot;
  const unreadEmailCount = snapshot.emails.filter((email) => email.unread).length;
  const activeProjectCount = snapshot.projects.filter(
    (project) => project.status !== "delivered",
  ).length;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>("all");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  function handleRefresh() {
    setLastRefreshedAt(new Date());
  }

  function handleCreateProject() {
    // Placeholder; will connect to project creation workflow.
  }

  return (
    <section
      className="mainview-container"
      aria-labelledby="dashboard-heading"
      id="dashboard-view"
      role="region"
    >
      <DashboardHeader
        client={snapshot.client}
        time={snapshot.time}
        unreadEmailCount={unreadEmailCount}
        activeProjectCount={activeProjectCount}
      />
      <DashboardToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={handleRefresh}
        onCreateProject={handleCreateProject}
        lastRefreshedAt={lastRefreshedAt}
      />
      <DashboardContent
        snapshot={snapshot}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        lastRefreshedAt={lastRefreshedAt}
      />
    </section>
  );
}

export default DashboardView;
