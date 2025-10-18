import { X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

export interface ClientsHeaderProps {
  onClose?: () => void;
  title?: string;
  headingId?: string;
}

export function ClientsHeader({ onClose, title = "Clients", headingId = "clients-heading" }: ClientsHeaderProps) {
  return (
    <div>
      <header className="dashboard-header-zone flex items-center gap-3" aria-label="Clients header">
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground" id={headingId}>
            {title}
          </h2>
        </div>
        {onClose ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close clients view"
                onClick={onClose}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              Close
            </TooltipContent>
          </Tooltip>
        ) : null}
      </header>
      <div className="sidebar-one__logo-divider" aria-hidden="true" />
    </div>
  );
}
