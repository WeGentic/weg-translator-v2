import { ArrowRight, Clock, Folder, Layers } from "lucide-react";

interface ProjectsOverviewCardProps {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  recentlyUpdated: number;
}

const METRIC_ICON_CLASSES =
  "h-4 w-4 text-(--color-victorian-peacock-700) transition-transform duration-200 group-hover:scale-110";

export function ProjectsOverviewCard({
  totalProjects,
  activeProjects,
  totalFiles,
  recentlyUpdated,
}: ProjectsOverviewCardProps) {
  const metrics = [
    {
      label: "Total projects",
      value: totalProjects,
      icon: Folder,
      description: "Projects currently tracked in the workspace.",
    },
    {
      label: "Active",
      value: activeProjects,
      icon: Layers,
      description: "Projects with running or in-progress activity.",
    },
    {
      label: "Files attached",
      value: totalFiles,
      icon: ArrowRight,
      description: "All files linked across every project.",
    },
    {
      label: "Updated (24h)",
      value: recentlyUpdated,
      icon: Clock,
      description: "Projects touched within the last day.",
    },
  ];

  return (
    <div className="flex h-full w-full flex-col gap-4 px-4 py-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-(--color-victorian-peacock-900)">Workspace overview</h2>
          <p className="text-xs text-muted-foreground">Quick snapshot of current project activity.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {metrics.map(({ label, value, icon: Icon, description }) => (
          <article
            key={label}
            className="group flex flex-col gap-2 rounded-lg border border-border/50 bg-background/40 p-3 shadow-sm transition-colors duration-200 hover:border-(--color-primary)/60 hover:bg-background"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Icon className={METRIC_ICON_CLASSES} aria-hidden />
            </div>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
