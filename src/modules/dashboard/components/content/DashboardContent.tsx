import type { DashboardSnapshot, DashboardStatusFilter } from "../../data/dashboard.types";
import {
  EmailsCard,
  ClientCard,
  ProjectsCard,
  ResourcesCard,
  OptionsCard,
  TimeCard,
  OpenTabsCard,
} from "./cards";
import "./dashboard-content.css";

export interface DashboardContentProps {
  snapshot: DashboardSnapshot;
  searchTerm: string;
  statusFilter: DashboardStatusFilter;
  lastRefreshedAt: Date | null;
}

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

export function DashboardContent({
  snapshot,
  searchTerm,
  statusFilter,
  lastRefreshedAt,
}: DashboardContentProps) {
  const query = searchTerm.trim().toLowerCase();
  const hasQuery = query.length > 0;

  const filteredEmails = hasQuery
    ? snapshot.emails.filter(
        (email) =>
          matchesQuery(email.subject, query) ||
          matchesQuery(email.preview, query) ||
          matchesQuery(email.sender, query),
      )
    : snapshot.emails;

  const filteredProjects = snapshot.projects.filter((project) => {
    const statusMatches = statusFilter === "all" || project.status === statusFilter;
    if (!statusMatches) return false;
    if (!hasQuery) return true;
    return (
      matchesQuery(project.name, query) ||
      matchesQuery(project.languagePair, query) ||
      matchesQuery(project.owner, query)
    );
  });

  const filteredResources = hasQuery
    ? snapshot.resources.filter(
        (resource) =>
          matchesQuery(resource.label, query) || matchesQuery(resource.description, query),
      )
    : snapshot.resources;

  const filteredTabs = hasQuery
    ? snapshot.openTabs.filter(
        (tab) =>
          matchesQuery(tab.documentName, query) ||
          matchesQuery(tab.projectName, query) ||
          matchesQuery(tab.languagePair, query),
      )
    : snapshot.openTabs;

  return (
    <main className="dashboard-content" aria-label="Dashboard main content">
      <div className="dashboard-content__grid">
        <EmailsCard
          emails={filteredEmails}
          className="dashboard-content__item dashboard-content__item--span-2"
        />
        <ClientCard client={snapshot.client} className="dashboard-content__item" />
        <ProjectsCard
          projects={filteredProjects}
          statusFilter={statusFilter}
          className="dashboard-content__item dashboard-content__item--span-2"
        />
        <ResourcesCard resources={filteredResources} className="dashboard-content__item" />
        <OptionsCard options={snapshot.options} className="dashboard-content__item" />
        <TimeCard
          time={snapshot.time}
          lastRefreshedAt={lastRefreshedAt}
          className="dashboard-content__item"
        />
        <OpenTabsCard tabs={filteredTabs} className="dashboard-content__item" />
      </div>
    </main>
  );
}
