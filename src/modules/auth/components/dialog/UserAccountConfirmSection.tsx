/**
 * Confirmation body prompting the user to finalize logout, surfaced in the dialog confirm stage.
 */
import { LogOut } from "lucide-react";

interface UserAccountConfirmSectionProps {
  displayName: string;
  error: string | null;
}

export function UserAccountConfirmSection({ displayName, error }: UserAccountConfirmSectionProps) {
  return (
    <section className="user-account-dialog__confirm" role="status" aria-live="polite">
      <div className="user-account-dialog__confirm-icon" aria-hidden="true">
        <LogOut className="user-account-dialog__confirm-icon-symbol" aria-hidden="true" />
      </div>
      <p className="user-account-dialog__confirm-message">
        Are you sure you want to sign out, {displayName}?
      </p>
      <p className="user-account-dialog__confirm-note">
        Any active translations will pause until you return and sign in again.
      </p>
      {error ? (
        <p className="user-account-dialog__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
