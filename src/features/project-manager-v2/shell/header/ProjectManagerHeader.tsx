import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ProjectManagerHeaderProps {
  onCreateProject?: () => void;
}

export function ProjectManagerHeader({ onCreateProject }: ProjectManagerHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between rounded-xl border border-border bg-background/80 px-4 shadow-sm">
      <h1 className="text-base font-semibold text-foreground">Projects</h1>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              className="gap-2 bg-[var(--color-tr-primary-blue)] text-[var(--color-tr-anti-primary)] hover:bg-[var(--color-tr-primary-blue)]/90"
              onClick={onCreateProject}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">New Project</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create a new project</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>
  );
}
