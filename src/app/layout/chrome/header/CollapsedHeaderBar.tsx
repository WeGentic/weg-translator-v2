import { Eye } from "lucide-react";

import { useLayoutStoreApi } from "@/app/layout/MainLayout";
import { Button } from "@/components/ui/button";

/**
 * Collapsed header affordance shown when users hide the main workspace header.
 */
export function CollapsedHeaderBar() {
  const layoutStore = useLayoutStoreApi();
  // Restoring via the store avoids passing unbound setter references to event handlers.
  const handleRestore = () => {
    layoutStore.getState().setHeader({ visible: true, mounted: true });
  };

  return (
    <div className="flex h-10 items-center justify-between border-b border-border/60 bg-transparent px-4 backdrop-blur">
      <span className="text-xs text-muted-foreground">Header hidden</span>
      <Button variant="ghost" size="sm" type="button" onClick={handleRestore}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show header
      </Button>
    </div>
  );
}
