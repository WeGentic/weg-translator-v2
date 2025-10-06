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

export function ProjectsSkeleton() {
  return (
    <section
      aria-label="Loading projects"
      className="flex flex-1 flex-col gap-4"
    >
      <header className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-9 w-48 animate-pulse rounded-md bg-muted/60" />
            <div className="h-9 w-40 animate-pulse rounded-md bg-muted/60" />
            <div className="hidden h-9 w-36 animate-pulse rounded-md bg-muted/60 md:block" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted/60" />
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted/60" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
          <div className="hidden h-20 animate-pulse rounded-xl bg-muted/40 md:block" />
          <div className="hidden h-20 animate-pulse rounded-xl bg-muted/40 lg:block" />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3">
        <div className="h-10 w-56 animate-pulse rounded-md bg-muted/60" />
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm">
          <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-9 w-64 animate-pulse rounded-md bg-muted/60" />
                <div className="h-9 w-32 animate-pulse rounded-md bg-muted/60" />
                <div className="h-9 w-40 animate-pulse rounded-md bg-muted/60" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-24 animate-pulse rounded-md bg-muted/60" />
                <div className="h-9 w-24 animate-pulse rounded-md bg-muted/60" />
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {SKELETON_ROW_KEYS.map((rowKey) => (
                <div key={rowKey} className="h-10 animate-pulse rounded-md bg-muted/40" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
