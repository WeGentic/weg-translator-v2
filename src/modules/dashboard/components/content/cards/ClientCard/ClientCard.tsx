import { Mail } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DashboardCard } from "../../../primitives";
import type { DashboardClientSnapshot } from "../../../../data/dashboard.types";

import "./ClientCard.css";

export interface ClientCardProps {
  client: DashboardClientSnapshot;
  className?: string;
}

const STATUS_VARIANT: Record<DashboardClientSnapshot["status"], "default" | "secondary" | "destructive"> = {
  active: "default",
  onboarding: "secondary",
  paused: "destructive",
};

export function ClientCard({ client, className }: ClientCardProps) {
  return (
    <DashboardCard
      id="dashboard-card-client"
      title="Client pulse"
      description="Account health and relationship context"
      actions={
        <Button type="button" size="sm" className="dashboard-card__action">
          View profile
        </Button>
      }
      bodyClassName="dashboard-client-card"
      className={className}
    >
      <div className="dashboard-client-card__header">
        <div>
          <p className="dashboard-client-card__name">{client.name}</p>
          <p className="dashboard-client-card__industry">{client.industry}</p>
        </div>
        <Badge variant={STATUS_VARIANT[client.status]} className="dashboard-client-card__status">
          {client.status}
        </Badge>
      </div>

      <dl className="dashboard-client-card__meta">
        <div>
          <dt>Account manager</dt>
          <dd>{client.accountManager}</dd>
        </div>
        <div>
          <dt>Contract status</dt>
          <dd>{client.contractsExpiringInDays} days until renewal</dd>
        </div>
      </dl>

      <div className="dashboard-client-card__contact">
        <Mail className="h-4 w-4" aria-hidden="true" />
        <a href={`mailto:${client.contactEmail}`} className="dashboard-card__link">
          {client.contactEmail}
        </a>
      </div>
    </DashboardCard>
  );
}
