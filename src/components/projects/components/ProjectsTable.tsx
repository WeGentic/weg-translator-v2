import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderOpen, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

export interface ProjectManagerRow {
  id: string;
  name: string;
  createdLabel: string;
  createdDetail: string;
  updatedLabel: string;
  updatedDetail: string;
  status: string;
}

interface ProjectsTableProps {
  rows: ProjectManagerRow[];
  onOpenProject?: (projectId: string) => void;
  onRequestDelete?: (projectId: string, projectName: string) => void;
}

export function ProjectsTable({ rows, onOpenProject, onRequestDelete }: ProjectsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm">
      <Table aria-label="Projects table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Project</TableHead>
            <TableHead className="w-[30%]">Dates</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[20%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} role="row" className="transition-colors hover:bg-muted/40">
              <TableCell role="cell">
                <div className="max-w-xs truncate font-medium text-foreground" title={row.name}>
                  {row.name}
                </div>
                </TableCell>
                <TableCell role="cell">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground/80">Created</span>
                      <time className="font-medium text-foreground" title={row.createdDetail}>
                        {row.createdLabel}
                      </time>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground/80">Updated</span>
                      <time className="font-medium text-foreground" title={row.updatedDetail}>
                        {row.updatedLabel}
                      </time>
                    </div>
                  </div>
                </TableCell>
                <TableCell role="cell">
                  <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground/90">
                    {row.status}
                  </span>
                </TableCell>
                <TableCell role="cell" className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconTooltipButton
                      label="Open project"
                      ariaLabel={`Open project ${row.name}`}
                      onClick={() => onOpenProject?.(row.id)}
                      disabled={!onOpenProject}
                    >
                      <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    </IconTooltipButton>

                    <IconTooltipButton
                      label="Delete project"
                      ariaLabel={`Delete project ${row.name}`}
                      onClick={() => onRequestDelete?.(row.id, row.name)}
                      disabled={!onRequestDelete}
                      variant="ghost-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconTooltipButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  );
}

type IconTooltipButtonProps = {
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "ghost" | "ghost-destructive";
  children: React.ReactNode;
};

function IconTooltipButton({ label, ariaLabel, disabled, onClick, variant = "ghost", children }: IconTooltipButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = () => setIsOpen(false);

  const buttonClasses =
    variant === "ghost-destructive"
      ? "text-destructive hover:text-destructive focus-visible:text-destructive"
      : "";

  return (
    <>
      <Button
        ref={buttonRef}
        size="icon"
        variant="ghost"
        aria-label={ariaLabel}
        aria-describedby={isOpen ? tooltipId : undefined}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        className={buttonClasses}
      >
        {children}
      </Button>
      {isOpen && !disabled
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[999] -translate-x-1/2 rounded-md border border-border/50 bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
              style={{ top: `${Math.max(position.top, 8)}px`, left: `${position.left}px` }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
