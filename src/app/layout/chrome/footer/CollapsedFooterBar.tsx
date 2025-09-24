import { Eye } from "lucide-react";

import { useLayoutStoreApi } from "@/app/layout/MainLayout";
import { Button } from "@/components/ui/button";

/**
 * Minimal footer affordance that allows users to restore the workspace footer.
 */
export function CollapsedFooterBar() {
  const layoutStore = useLayoutStoreApi();
  // Calling the store directly avoids passing unbound methods, which keeps the
  // component compliant with the React 19 ESLint rules.
  const handleRestore = () => {
    layoutStore.getState().setFooter({ visible: true, mounted: true });
  };

  return (
    <div className="sticky bottom-0 z-30 flex h-10 w-full items-center justify-center border-t border-border/60 bg-transparent px-4 backdrop-blur">
      <Button variant="ghost" size="sm" type="button" onClick={handleRestore}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show footer
      </Button>
    </div>
  );
}
