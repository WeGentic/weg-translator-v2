import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Collapsed header affordance shown when users hide the main workspace header.
 */
export function CollapsedHeaderBar({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur">
      <span className="text-xs text-muted-foreground">Header hidden</span>
      <Button variant="ghost" size="sm" type="button" onClick={onExpand}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show header
      </Button>
    </div>
  );
}
