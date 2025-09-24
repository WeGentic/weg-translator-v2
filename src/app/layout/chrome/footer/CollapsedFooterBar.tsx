import { Eye } from "lucide-react";

import { useLayoutActions } from "@/app/layout/MainLayout";
import { Button } from "@/components/ui/button";

/**
 * Minimal footer affordance that allows users to restore the workspace footer.
 */
export function CollapsedFooterBar() {
  const setFooter = useLayoutActions((state) => state.setFooter);

  return (
    <div className="sticky bottom-0 z-30 flex h-10 w-full items-center justify-center border-t border-border/60 bg-transparent px-4 backdrop-blur">
      <Button variant="ghost" size="sm" type="button" onClick={() => setFooter({ visible: true, mounted: true })}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show footer
      </Button>
    </div>
  );
}
