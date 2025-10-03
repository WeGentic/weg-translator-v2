import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelContent, ThreeZonePanel } from "@wegentic/layout-three-zone";

function ResourcesRoute() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "resource" },
      }),
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 160);
    return () => window.clearTimeout(timer);
  }, []);

  const loadingContent = useMemo(
    () => (
      <PanelContent>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {["overview", "library"].map((key) => (
            <div
              key={`resource-skeleton-${key}`}
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
            <h1 className="text-lg font-semibold text-foreground">Resources</h1>
            <p className="text-xs text-muted-foreground">
              Manage glossaries, memories, models, and shared assets for your teams.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Import
            </Button>
            <Button variant="default" size="sm">
              Sync
            </Button>
          </div>
        </div>
      }
      toolbar={
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
            <Input placeholder="Search resources" className="sm:max-w-xs" />
            <div className="flex w-full flex-1 gap-2 sm:w-auto">
              <Select defaultValue="all-types">
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">All types</SelectItem>
                  <SelectItem value="glossary">Glossaries</SelectItem>
                  <SelectItem value="memory">Translation memories</SelectItem>
                  <SelectItem value="model">Models</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all-status">
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Refresh
            </Button>
            <Button variant="ghost" size="sm">
              Bulk actions
            </Button>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>0 resources • Last sync not yet run</span>
          <span>Storage usage: 0%</span>
        </div>
      }
    >
      {isLoading ? (
        loadingContent
      ) : (
        <PanelContent>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm backdrop-blur">
              <h2 className="text-sm font-semibold text-foreground">Resource Overview</h2>
              <p className="text-xs text-muted-foreground">
                Placeholder summary cards for counts, retention windows, and sync status across resource types.
              </p>
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex flex-col items-start justify-between gap-2 rounded-lg border border-border/50 bg-popover/40 p-3 text-muted-foreground">
                  <span className="text-xs font-medium text-foreground/80">Glossaries</span>
                  <span className="text-2xl font-semibold text-foreground">0</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Awaiting import</span>
                </div>
                <div className="flex flex-col items-start justify-between gap-2 rounded-lg border border-border/50 bg-popover/40 p-3 text-muted-foreground">
                  <span className="text-xs font-medium text-foreground/80">Translation Memories</span>
                  <span className="text-2xl font-semibold text-foreground">0</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Coming soon</span>
                </div>
                <div className="flex flex-col items-start justify-between gap-2 rounded-lg border border-border/50 bg-popover/40 p-3 text-muted-foreground">
                  <span className="text-xs font-medium text-foreground/80">Models</span>
                  <span className="text-2xl font-semibold text-foreground">0</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Link provider</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm backdrop-blur">
              <h2 className="text-sm font-semibold text-foreground">Resource Library</h2>
              <p className="text-xs text-muted-foreground">
                Placeholder list for upcoming resource table with filters, sorting, and quick actions.
              </p>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 p-4 text-xs text-muted-foreground">
                  Resource table placeholder
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 bg-muted/30 p-6 text-center text-xs text-muted-foreground">
                  <p>No resources yet.</p>
                  <p>Import a glossary, connect a translation memory, or register a terminology model.</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="secondary" size="sm">
                      Import glossary
                    </Button>
                    <Button variant="outline" size="sm">
                      Connect memory
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PanelContent>
      )}
    </ThreeZonePanel>
  );
}

export const Route = createFileRoute("/resources/")({
  component: ResourcesRoute,
});
