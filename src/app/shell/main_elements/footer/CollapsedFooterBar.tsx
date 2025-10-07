import { Eye } from "lucide-react";

import { useLayoutStoreApi } from "@/app/shell/MainLayout";
import { Button } from "@/shared/ui/button";
import "@/shared/styles/layout/chrome/footer/collapsed-footer-bar.css";

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
    <div className="collapsed-footer-bar">
      <Button variant="ghost" size="sm" type="button" onClick={handleRestore}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show footer
      </Button>
    </div>
  );
}
