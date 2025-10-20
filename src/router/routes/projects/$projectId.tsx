import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProjectOverviewRoute } from "@/modules/projects";
import type { ProjectOverviewContextValue } from "@/modules/projects/routes/project-overview-context";
import type { ProjectListItem } from "@/core/ipc";
import { getProjectBundle, getProjectStatistics } from "@/core/ipc";
import type { ProjectBundle, ProjectRecord } from "@/shared/types/database";
import type { ProjectStatistics } from "@/shared/types/statistics";

export const Route = createFileRoute("/projects/$projectId")({
  loader: async ({ params }) => loadProjectOverview(params.projectId),
  pendingComponent: ProjectOverviewPending,
  errorComponent: ProjectOverviewError,
  component: ProjectOverviewRouteLoader,
});

function ProjectOverviewRouteLoader() {
  const data = Route.useLoaderData();
  return <ProjectOverviewRoute {...data} />;
}

function ProjectOverviewPending() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Preparing project workspace…
      </div>
    </div>
  );
}

function ProjectOverviewError({ error }: { error: unknown }) {
  const message =
    error instanceof Error && error.message.length > 0
      ? error.message
      : "Unable to load project workspace. Please try again.";
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md space-y-3 rounded-xl border border-border/60 bg-muted/30 p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">Project overview unavailable</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

async function loadProjectOverview(projectId: string): Promise<ProjectOverviewContextValue> {
  if (!projectId || typeof projectId !== "string") {
    throw redirect({ to: "/", search: { reason: "missingProjectId" } });
  }

  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    throw redirect({ to: "/", search: { reason: "projectNotFound", projectId } });
  }

  let statistics: ProjectStatistics | null = null;
  try {
    statistics = await getProjectStatistics(projectId);
  } catch (error) {
    console.warn("[project-overview] statistics fetch failed", error);
  }

  const summary = mapProjectRecordToListItem(bundle.project, bundle);
  return {
    projectId,
    summary,
    bundle,
    statistics,
  };
}

function mapProjectRecordToListItem(record: ProjectRecord, bundle: ProjectBundle): ProjectListItem {
  const normalizedStatus = record.projectStatus?.toUpperCase?.() ?? "READY";
  return {
    projectId: record.projectUuid,
    name: record.projectName,
    slug: slugify(record.projectName || record.projectUuid),
    projectType: record.type,
    status: normalizedStatus,
    activityStatus: "pending",
    fileCount: record.fileCount ?? bundle.files.length ?? 0,
    createdAt: record.creationDate,
    updatedAt: record.updateDate,
    clientId: record.clientUuid ?? null,
    clientName: record.clientName ?? null,
    notes: record.notes ?? null,
    subjects: bundle.subjects.length > 0 ? [...bundle.subjects] : record.subjects ?? [],
  };
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
