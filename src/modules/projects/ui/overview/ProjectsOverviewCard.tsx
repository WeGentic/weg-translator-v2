import { TbFolders, TbFileText, TbClock, TbActivity } from "react-icons/tb";

type ProjectsOverviewCardProps = {
  totalProjects: number;
  activeProjects?: number;
  totalFiles?: number;
  recentlyUpdated?: number;
};

export function ProjectsOverviewCard({
  totalProjects,
  activeProjects = 0,
  totalFiles = 0,
  recentlyUpdated = 0,
}: ProjectsOverviewCardProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-3">
      {/* Statistics Grid */}
      <div className="flex flex-col gap-2">
        {/* Total Projects Card */}
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-background/80 to-background/60 p-2.5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <TbFolders className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-muted-foreground">Total Projects</div>
              <div className="text-lg font-bold text-foreground leading-tight">{totalProjects}</div>
            </div>
          </div>
        </div>

        {/* Active Projects Card */}
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-background/80 to-background/60 p-2.5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-green-500/15 text-green-600 dark:text-green-400">
              <TbActivity className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-muted-foreground">Active</div>
              <div className="text-lg font-bold text-foreground leading-tight">{activeProjects}</div>
            </div>
          </div>
        </div>

        {/* Total Files Card */}
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-background/80 to-background/60 p-2.5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <TbFileText className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-muted-foreground">Total Files</div>
              <div className="text-lg font-bold text-foreground leading-tight">{totalFiles}</div>
            </div>
          </div>
        </div>

        {/* Recently Updated Card */}
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-background/80 to-background/60 p-2.5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <TbClock className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-muted-foreground">Updated (24h)</div>
              <div className="text-lg font-bold text-foreground leading-tight">{recentlyUpdated}</div>
            </div>
          </div>
        </div>

        {/* Implementation Note */}
        <div className="mt-2 rounded-lg border border-dashed border-border/50 bg-muted/20 p-2">
          <p className="text-[9px] text-muted-foreground leading-snug">
            <span className="font-semibold text-foreground">Note:</span> Additional statistics will be implemented with backend integration.
          </p>
        </div>
      </div>
    </div>
  );
}
