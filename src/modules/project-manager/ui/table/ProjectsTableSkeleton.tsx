export function ProjectsTableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading projects"
      className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm"
    >
      {/* Toolbar skeleton */}
      <div className="sticky top-0 z-10 -mb-px border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-64 animate-pulse rounded-md bg-muted/60" />
            <div className="h-9 w-36 animate-pulse rounded-md bg-muted/60" />
            <div className="h-9 w-40 animate-pulse rounded-md bg-muted/60" />
            <div className="h-9 w-44 animate-pulse rounded-md bg-muted/60" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted/60" />
            <div className="h-9 w-36 animate-pulse rounded-md bg-muted/60" />
          </div>
        </div>
      </div>

      {/* Rows skeleton */}
      <div className="p-3">
        <div className="space-y-2">
          {SKELETON_ROW_KEYS.map((key) => (
            <div key={key} className="h-9 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      </div>
    </div>
  );
}

const SKELETON_ROW_KEYS = [
  "projects-skeleton-row-1",
  "projects-skeleton-row-2",
  "projects-skeleton-row-3",
  "projects-skeleton-row-4",
  "projects-skeleton-row-5",
  "projects-skeleton-row-6",
  "projects-skeleton-row-7",
  "projects-skeleton-row-8",
];
