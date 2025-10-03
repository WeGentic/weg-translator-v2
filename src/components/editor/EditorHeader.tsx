import { useCallback } from "react";
import { PanelLeft, PanelLeftClose, X } from "lucide-react";

import { useLayoutSelector, useLayoutStoreApi } from "@/app/layout";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type EditorHeaderProps = {
  title: string;
  onCloseEditor?: () => void;
};

/**
 * Focused editor header that swaps in when the workspace enters editor mode.
 * It keeps sidebar visibility bound to hidden/compact and exposes a close
 * action so users can return to the project overview.
 */
export function EditorHeader({ title, onCloseEditor }: EditorHeaderProps) {
  const layoutStore = useLayoutStoreApi();
  const sidemenuMode = useLayoutSelector((state) => state.sidemenu.mode);

  const isSidebarHidden = sidemenuMode === "hidden";

  const handleToggleSidebar = useCallback(() => {
    const nextMode = isSidebarHidden ? "compact" : "hidden";
    layoutStore.getState().setSidemenu({ mode: nextMode, mounted: true });
  }, [isSidebarHidden, layoutStore]);

  const handleCloseEditor = useCallback(() => {
    onCloseEditor?.();
  }, [onCloseEditor]);

  const ToggleIcon = isSidebarHidden ? PanelLeft : PanelLeftClose;

  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={80}>
      <div
        className={cn(
          "flex h-full w-full items-center justify-between gap-3 border-b px-4 text-sm font-medium transition-colors",
          "border-border/60 bg-primary text-primary-foreground shadow-sm",
        )}
      >
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={isSidebarHidden ? "Show editor sidebar" : "Hide editor sidebar"}
                aria-pressed={!isSidebarHidden}
                onClick={handleToggleSidebar}
                className="h-9 w-9 rounded-full bg-primary/30 text-primary-foreground hover:bg-primary/40"
              >
                <ToggleIcon className="size-5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              {isSidebarHidden ? "Show tools" : "Hide tools"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <h1
            className="line-clamp-1 text-base font-semibold"
            title={title}
          >
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Close editor"
                onClick={handleCloseEditor}
                className="h-9 w-9 rounded-full bg-primary/30 text-primary-foreground hover:bg-primary/40"
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              Close editor
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default EditorHeader;
