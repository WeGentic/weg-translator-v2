import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelContent, ThreeZonePanel } from "@wegentic/layout-three-zone";

function DashboardRoute() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "dashboard" },
      }),
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, []);

  const loadingContent = useMemo(
    () => (
      <PanelContent>
        <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {["timeline", "links", "metrics", "jobs", "summary"].map((key) => (
            <div
              key={`dashboard-skeleton-${key}`}
              className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/30 p-4 shadow-sm animate-pulse"
            >
              <div className="h-4 w-1/3 rounded bg-muted-foreground/20" />
              <div className="h-3 w-2/3 rounded bg-muted-foreground/10" />
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/20" />
            </div>
          ))}
        </div>
      </PanelContent>
    ),
    [],
  );

  return (
    <ThreeZonePanel
      header={
        <div className="flex w-full items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
            <p className="text-xs text-muted-foreground">Overview of translation activity and quick shortcuts.</p>
          </div>
          <Button variant="default" size="sm">
            New Project
          </Button>
        </div>
      }
      toolbar={
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full max-w-xl items-center gap-2">
            <Input placeholder="Search dashboard" className="max-w-xs" />
            <Button variant="outline" size="sm">
              Filter
            </Button>
            <Button variant="ghost" size="sm">
              Quick Action
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Refresh
            </Button>
            <Button variant="ghost" size="sm">
              Export
            </Button>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>Last update: a few moments ago</span>
          <span>0 active projects · 0 actions pending</span>
        </div>
      }
    >
      {isLoading ? (
        loadingContent
      ) : (
        <PanelContent>
          <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-foreground">Activity Timeline</h2>
            <p className="text-xs text-muted-foreground">
              Visual timeline of recent translation runs and pipeline events. Configure data sources once backend integration lands.
            </p>
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/40 text-xs text-muted-foreground">
              Feed placeholder
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-foreground">Quick Links</h2>
            <p className="text-xs text-muted-foreground">Shortcuts into common workflows or saved filters.</p>
            <ul className="flex flex-1 flex-col gap-2 text-xs">
              <li className="rounded-lg border border-border/40 bg-popover/40 p-3 text-muted-foreground">
                Launch new translation from template
              </li>
              <li className="rounded-lg border border-border/40 bg-popover/40 p-3 text-muted-foreground">
                Review pending validations
              </li>
              <li className="rounded-lg border border-border/40 bg-popover/40 p-3 text-muted-foreground">
                Explore resource library updates
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm backdrop-blur xl:col-span-1 xl:row-span-2">
            <h2 className="text-sm font-semibold text-foreground">Empty State Placeholder</h2>
            <p className="text-xs text-muted-foreground">
              Space reserved for charts or KPI summaries once analytics pipelines are implemented.
            </p>
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/40 text-xs text-muted-foreground">
              KPI widget placeholder
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm backdrop-blur md:col-span-2">
            <h2 className="text-sm font-semibold text-foreground">In-progress Jobs</h2>
            <p className="text-xs text-muted-foreground">
              Future table for monitoring active translation jobs and their progress.
            </p>
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/40 text-xs text-muted-foreground">
              Jobs table placeholder
            </div>
          </div>
          </div>
        </PanelContent>
      )}
    </ThreeZonePanel>
  );
}

export const Route = createFileRoute("/dashboard/")({
  component: DashboardRoute,
});
