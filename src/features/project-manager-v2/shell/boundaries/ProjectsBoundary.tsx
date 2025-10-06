import { Suspense, type ReactNode } from "react";

import { AppErrorBoundary, type ErrorBoundaryFallbackProps } from "@/components/AppErrorBoundary";
import type { ProjectListQuery } from "@/ipc";

import { DEFAULT_PROJECTS_QUERY_LIMIT } from "../../data/projectsResource";
import { ProjectsError } from "./ProjectsError";
import { ProjectsSkeleton } from "./ProjectsSkeleton";

type ProjectsBoundaryProps = {
  children: ReactNode;
  query?: ProjectListQuery;
};

function getResetKeys(query?: ProjectListQuery) {
  const limit =
    typeof query?.limit === "number" && Number.isFinite(query.limit)
      ? Math.max(0, Math.trunc(query.limit))
      : DEFAULT_PROJECTS_QUERY_LIMIT;
  const offset =
    typeof query?.offset === "number" && Number.isFinite(query.offset)
      ? Math.max(0, Math.trunc(query.offset))
      : 0;
  return [limit, offset];
}

export function ProjectsBoundary({ children, query }: ProjectsBoundaryProps) {
  return (
    <AppErrorBoundary
      resetKeys={getResetKeys(query)}
      fallbackRender={(props: ErrorBoundaryFallbackProps) => (
        <ProjectsError {...props} query={query} />
      )}
    >
      <Suspense fallback={<ProjectsSkeleton />}>{children}</Suspense>
    </AppErrorBoundary>
  );
}
