import type { ReactNode } from "react";

import { cn } from "@/shared/utils/class-names";

import "./dashboard-card.css";

export interface DashboardCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id: string;
}

export function DashboardCard({
  title,
  description,
  children,
  actions,
  className,
  bodyClassName,
  id,
}: DashboardCardProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <section
      className={cn("dashboard-card", className)}
      aria-labelledby={id}
      aria-describedby={descriptionId}
      role="region"
    >
      <header className="dashboard-card__header">
        <div className="dashboard-card__heading">
          <h3 id={id} className="dashboard-card__title">
            {title}
          </h3>
          {description ? (
            <p id={descriptionId} className="dashboard-card__description">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="dashboard-card__actions">{actions}</div> : null}
      </header>
      <div className={cn("dashboard-card__body", bodyClassName)}>{children}</div>
    </section>
  );
}
