import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Minimal footer affordance that allows users to restore the workspace footer.
 */
export function CollapsedFooterBar({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="sticky bottom-0 z-30 flex h-10 w-full items-center justify-center border-t border-border/60 bg-background/90 px-4 backdrop-blur">
      <Button variant="ghost" size="sm" type="button" onClick={onExpand}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show footer
      </Button>
    </div>
  );
}
