import type { ComponentType, SVGProps } from "react";
import { Activity, Clock3, FileText, FolderKanban } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ProjectsOverviewCardProps {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  recentlyUpdated: number;
}

export function ProjectsOverviewCard({ totalProjects, activeProjects, totalFiles, recentlyUpdated }: ProjectsOverviewCardProps) {
  const metrics: MetricDescriptor[] = [
    {
      icon: FolderKanban,
      label: "Total Projects",
      value: totalProjects,
      accentClass: "bg-[var(--color-tr-primary-blue)]/15 text-[var(--color-tr-primary-blue)]",
    },
    {
      icon: Activity,
      label: "Active",
      value: activeProjects,
      accentClass: "bg-[var(--color-tr-success)]/15 text-[var(--color-tr-success)]",
    },
    {
      icon: FileText,
      label: "Total Files",
      value: totalFiles,
      accentClass: "bg-[var(--color-tr-accent)]/15 text-[var(--color-tr-accent-foreground)]",
    },
    {
      icon: Clock3,
      label: "Updated (24h)",
      value: recentlyUpdated,
      accentClass: "bg-[var(--color-tr-ring)]/15 text-[var(--color-tr-ring)]",
    },
  ];

  return (
    <Card className="border border-[var(--color-tr-sidebar-border)] bg-[var(--color-tr-sidebar)] text-[var(--color-tr-sidebar-foreground)] shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm font-semibold">Project Overview</CardTitle>
        <p className="text-xs text-[var(--color-tr-muted-foreground)]">
          Snapshot of project health across the workspace.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-3">
          {metrics.map((metric) => (
            <li key={metric.label} className="flex items-center gap-3 rounded-lg border border-[var(--color-tr-border)]/70 bg-[var(--color-tr-muted)]/50 px-3 py-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold",
                  metric.accentClass,
                )}
                aria-hidden="true"
              >
                <metric.icon className="h-4 w-4" />
              </div>
              <div className="flex flex-1 items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-tr-muted-foreground)]">
                  {metric.label}
                </span>
                <span className="text-base font-semibold text-[var(--color-tr-sidebar-foreground)]">
                  {metric.value}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

interface MetricDescriptor {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  accentClass: string;
}
