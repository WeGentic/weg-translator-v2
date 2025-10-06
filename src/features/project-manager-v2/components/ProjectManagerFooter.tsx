import { cn } from "@/lib/utils";

type ProjectManagerFooterProps = {
  totalProjects: number;
  selectedCount: number;
  className?: string;
};

export function ProjectManagerFooter({
  totalProjects,
  selectedCount,
  className,
}: ProjectManagerFooterProps) {
  const hasSelection = selectedCount > 0;

  return (
    <footer
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10 mt-auto flex-shrink-0",
        "border-t-2 border-border",
        "bg-gradient-to-r from-muted/15 via-muted/8 to-transparent",
        "backdrop-blur-sm shadow-sm",
        className,
      )}
      aria-live="polite"
    >
      <div className="px-4 py-3 text-[11px] font-medium text-primary">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total Projects:</span>
            <span className="inline-flex h-5 min-w-[24px] items-center justify-center rounded border border-primary/30 bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
              {totalProjects}
            </span>
          </span>

          {hasSelection ? (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Selected:</span>
              <span className="inline-flex h-5 min-w-[24px] items-center justify-center rounded border border-secondary/40 bg-secondary/20 px-1.5 text-[11px] font-semibold text-secondary-foreground">
                {selectedCount}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
