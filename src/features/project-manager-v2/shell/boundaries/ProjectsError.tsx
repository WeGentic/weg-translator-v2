import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_PROJECTS_QUERY_LIMIT, invalidateProjectsResource, refreshProjectsResource } from "../../data/projectsResource";
import type { ErrorBoundaryFallbackProps } from "@/components/AppErrorBoundary";
import type { ProjectListQuery } from "@/ipc";

interface ProjectsErrorProps extends ErrorBoundaryFallbackProps {
  query?: ProjectListQuery;
}

function normalizeQuery(query?: ProjectListQuery) {
  if (!query) {
    return undefined;
  }

  const limit =
    typeof query.limit === "number" && Number.isFinite(query.limit)
      ? Math.max(0, Math.trunc(query.limit))
      : DEFAULT_PROJECTS_QUERY_LIMIT;
  const offset =
    typeof query.offset === "number" && Number.isFinite(query.offset)
      ? Math.max(0, Math.trunc(query.offset))
      : 0;

  return { limit, offset } satisfies ProjectListQuery;
}

export function ProjectsError({ error, resetErrorBoundary, query }: ProjectsErrorProps) {
  const normalizedQuery = normalizeQuery(query);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    if (isRetrying) return;
    setIsRetrying(true);
    const refresh = async () => {
      try {
        invalidateProjectsResource(normalizedQuery);
        await refreshProjectsResource(normalizedQuery);
      } finally {
        setIsRetrying(false);
        resetErrorBoundary();
      }
    };

    void refresh();
  };

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl border-destructive/40 bg-background/95 text-foreground shadow-lg">
        <CardHeader className="flex items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">Unable to load projects</CardTitle>
            <CardDescription className="text-foreground/80">
              {error.message || "Something went wrong while requesting project data."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Please try again. If the issue persists, capture the console logs and share them with the
            WeGentic team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleRetry} disabled={isRetrying} className="gap-2">
              <RefreshCw className="size-4" aria-hidden="true" />
              {isRetrying ? "Retrying…" : "Try again"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
