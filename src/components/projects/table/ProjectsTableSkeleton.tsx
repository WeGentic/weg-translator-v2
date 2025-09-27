export function ProjectsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm">
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
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      </div>
    </div>
  );
}

