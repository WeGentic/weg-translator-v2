/**
 * Displays the authenticated user's profile summary within the account dialog.
 * TASK 8.3: Added role badge to display current role from JWT claims.
 */
import { Mail, UserCircle2 } from "lucide-react";
import { RoleBadge } from "@/modules/auth/components/RoleBadge";
import type { UserRole } from "@/shared/types/database";

interface UserAccountProfileSectionProps {
  displayName: string;
  emailLabel: string;
  initials: string;
  hasProfile: boolean;
  isAuthenticated: boolean;
  /**
   * TASK 8.3: User role from AuthProvider context (JWT claims)
   */
  userRole?: UserRole | null;
}

export function UserAccountProfileSection({
  displayName,
  emailLabel,
  initials,
  hasProfile,
  isAuthenticated,
  userRole,
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
          {/* TASK 8.3: Display role badge showing current role from JWT claims */}
          {userRole && (
            <div className="mt-2">
              <RoleBadge role={userRole} />
            </div>
          )}
        </div>
      </section>
      <div className="user-account-divider" aria-hidden="true" />
    </>
  );
}
