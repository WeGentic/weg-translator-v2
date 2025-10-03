import { useCallback } from "react";
import { ArrowLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type EditorHeaderProps = {
  title: string;
  subtitle?: string;
  onNavigateBack?: () => void;
  onCloseEditor?: () => void;
};

/**
 * Focused editor header that swaps in when the workspace enters editor mode.
 * It keeps sidebar visibility bound to hidden/compact and exposes a close
 * action so users can return to the project overview.
 */
export function EditorHeader({ title, subtitle, onNavigateBack, onCloseEditor }: EditorHeaderProps) {
  const handleCloseEditor = useCallback(() => {
    onCloseEditor?.();
  }, [onCloseEditor]);

  const handleNavigateBack = useCallback(() => {
    onNavigateBack?.();
  }, [onNavigateBack]);

  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={80}>
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Back to project"
                onClick={handleNavigateBack}
                disabled={!onNavigateBack}
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              Back to overview
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-1 flex-col items-center text-center">
          <h1 className="line-clamp-1 text-base font-semibold text-foreground" title={title}>
            {title}
          </h1>
          {subtitle ? (
            <p className="text-xs text-muted-foreground" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
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
