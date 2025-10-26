/**
 * Entry point for the user account dialog, wiring controller state into the view layer.
 */
import { UserAccountDialogView } from "@/modules/auth/components/dialog/UserAccountDialogView";
import { useUserAccountDialog } from "@/modules/auth/hooks/controllers/useUserAccountDialog";

import "./css/dialog/user-account-dialog.css";

export interface UserAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserAccountDialog({ open, onOpenChange }: UserAccountDialogProps) {
  const controller = useUserAccountDialog({ open, onOpenChange });

  return (
    <UserAccountDialogView
      open={open}
      title={controller.title}
      description={controller.description}
      stage={controller.stage}
      displayName={controller.displayName}
      emailLabel={controller.emailLabel}
      initials={controller.initials}
      hasProfile={controller.hasProfile}
      isAuthenticated={controller.isAuthenticated}
      pending={controller.pending}
      error={controller.error}
      confirmButtonRef={controller.confirmButtonRef}
      onOpenChange={controller.handleOpenChange}
      onRequestLogout={controller.handleRequestLogout}
      onCancelConfirm={controller.handleCancelConfirm}
      onConfirmLogout={controller.handleConfirmLogout}
    />
  );
}
