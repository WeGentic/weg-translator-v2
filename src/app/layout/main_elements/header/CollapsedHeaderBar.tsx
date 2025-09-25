import { Eye } from "lucide-react";

import { useLayoutStoreApi } from "@/app/layout/MainLayout";
import { Button } from "@/components/ui/button";
import "../../css-styles/chrome/header/collapsed-header-bar.css";

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
    <div className="collapsed-header-bar">
      <span className="collapsed-header-bar__label">Header hidden</span>
      <Button variant="ghost" size="sm" type="button" onClick={handleRestore}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show header
      </Button>
    </div>
  );
}
