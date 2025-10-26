import { Paperclip } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { DashboardCard } from "../../../primitives";
import type { DashboardEmail } from "../../../../data/dashboard.types";

import "./EmailsCard.css";

export interface EmailsCardProps {
  emails: DashboardEmail[];
  maxVisible?: number;
  className?: string;
}

function formatReceivedAt(receivedAt: string) {
  try {
    const date = new Date(receivedAt);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return receivedAt;
  }
}

export function EmailsCard({ emails, maxVisible = 4, className }: EmailsCardProps) {
  const visibleEmails = emails.slice(0, maxVisible);

  return (
    <DashboardCard
      id="dashboard-card-emails"
      title="Inbox highlights"
      description="Latest localization conversations and approvals"
      actions={
        <button type="button" className="dashboard-card__link" aria-label="Open full inbox">
          View inbox
        </button>
      }
      bodyClassName="dashboard-emails-card"
      className={className}
    >
      {visibleEmails.length === 0 ? (
        <div className="dashboard-emails-card__empty" role="status">
          <p>No emails to show.</p>
        </div>
      ) : (
        <ul className="dashboard-emails-card__list">
          {visibleEmails.map((email) => (
            <li key={email.id} className="dashboard-emails-card__item">
              <div className="dashboard-emails-card__header">
                <span className="dashboard-emails-card__sender">{email.sender}</span>
                <div className="dashboard-emails-card__tags">
                  {email.unread ? <Badge variant="secondary">Unread</Badge> : null}
                  {email.priority === "high" ? <Badge variant="destructive">High priority</Badge> : null}
                </div>
              </div>
              <p className="dashboard-emails-card__subject">{email.subject}</p>
              <p className="dashboard-emails-card__preview">{email.preview}</p>
              <div className="dashboard-emails-card__footer">
                <time dateTime={email.receivedAt}>{formatReceivedAt(email.receivedAt)}</time>
                {email.hasAttachment ? (
                  <span className="dashboard-emails-card__attachment" aria-label="Attachment included">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
