/**
 * Displays the authenticated user's profile summary within the account dialog.
 */
import { Mail, UserCircle2 } from "lucide-react";

interface UserAccountProfileSectionProps {
  displayName: string;
  emailLabel: string;
  initials: string;
  hasProfile: boolean;
  isAuthenticated: boolean;
}

export function UserAccountProfileSection({
  displayName,
  emailLabel,
  initials,
  hasProfile,
  isAuthenticated,
}: UserAccountProfileSectionProps) {
  return (
    <>
      <section className="user-account-dialog__profile">
        <div className="user-account-dialog__avatar" aria-hidden="true">
          {hasProfile && initials ? (
            initials
          ) : (
            <UserCircle2 className="user-account-dialog__avatar-icon" aria-hidden="true" />
          )}
        </div>
        <div className="user-account-dialog__details">
          <p className="user-account-dialog__name">{displayName}</p>
          <p className="user-account-dialog__email">
            <Mail className="user-account-dialog__email-icon" aria-hidden="true" />
            <span>{emailLabel}</span>
          </p>
          <p className="user-account-dialog__status" role="status">
            {isAuthenticated ? "Status: Signed in" : "Status: Signed out"}
          </p>
        </div>
      </section>
      <div className="user-account-divider" aria-hidden="true" />
    </>
  );
}
