import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { Plus } from "lucide-react";

export interface ProjectManagerHeaderProps {
  onCreateProject?: () => void;
}

export function ProjectManagerHeader({ onCreateProject }: ProjectManagerHeaderProps) {
  return (
    <>
      {/* Header Zone - 54px fixed height */}
      <div className="projects-table-header-zone flex items-center justify-between px-4">
        <h2 className="text-base font-semibold text-foreground">Project Manager</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={onCreateProject}
                size="sm"
                className="new-project-button"
                aria-label="Create new project"
              >
                <Plus className="h-5 w-5" />
                <span className="font-medium">New Project</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create new project</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="sidebar-one__logo-divider" aria-hidden="true" />
    </>
  );
}
