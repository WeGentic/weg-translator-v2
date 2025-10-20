import type { ReactNode } from "react";

import { cn } from "@/shared/utils/class-names";

export interface ProjectViewLayoutProps {
  id: string;
  ariaLabelledBy?: string;
  header?: ReactNode;
  toolbar?: ReactNode;
  toolbarClassName?: string;
  alerts?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  afterContent?: ReactNode;
  className?: string;
}

const DEFAULT_ROOT_CLASS = "mainview-container flex flex-1 min-h-0 flex-col";
const DEFAULT_TOOLBAR_CLASS = "projects-table-toolbar-zone";

export function ProjectViewLayout({
  id,
  ariaLabelledBy,
  header,
  toolbar,
  toolbarClassName,
  alerts,
  footer,
  children,
  afterContent,
  className,
}: ProjectViewLayoutProps) {
  return (
    <section
      id={id}
      role="region"
      aria-labelledby={ariaLabelledBy}
      className={cn(DEFAULT_ROOT_CLASS, className)}
    >
      <div className="flex flex-1 min-h-0 flex-col">
        {header}
        {toolbar ? <div className={cn(DEFAULT_TOOLBAR_CLASS, toolbarClassName)}>{toolbar}</div> : null}
        {alerts}
        <div className="flex flex-1 min-h-0 overflow-hidden">{children}</div>
        {footer}
      </div>
      {afterContent}
    </section>
  );
}

export default ProjectViewLayout;
