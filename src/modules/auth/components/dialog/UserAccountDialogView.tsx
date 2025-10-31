/**
 * Pure view for the user account dialog, showing profile or confirmation sections based on stage.
 * TASK 8.3: Added userRole prop for role badge display
 */
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { LogOut, Loader2 } from "lucide-react";
import type { MutableRefObject } from "react";
import type { UserRole } from "@/shared/types/database";

import { UserAccountProfileSection } from "./UserAccountProfileSection";
import { UserAccountConfirmSection } from "./UserAccountConfirmSection";

export interface UserAccountDialogViewProps {
  open: boolean;
  title: string;
  description: string;
  stage: "profile" | "confirm";
  displayName: string;
  emailLabel: string;
  initials: string;
  hasProfile: boolean;
  isAuthenticated: boolean;
  pending: boolean;
  error: string | null;
  confirmButtonRef: MutableRefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  onRequestLogout: () => void;
  onCancelConfirm: () => void;
  onConfirmLogout: () => Promise<void>;
  /**
   * TASK 8.3: User role from JWT claims for role badge display
   */
  userRole?: UserRole | null;
}

export function UserAccountDialogView({
  open,
  title,
  description,
  stage,
  displayName,
  emailLabel,
  initials,
  hasProfile,
  isAuthenticated,
  pending,
  error,
  confirmButtonRef,
  onOpenChange,
  onRequestLogout,
  onCancelConfirm,
  onConfirmLogout,
  userRole,
}: UserAccountDialogViewProps) {
  const isConfirmStage = stage === "confirm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="user-account-dialog"
        aria-describedby="user-account-dialog-description"
      >
        <DialogHeader className="user-account-dialog__header">
          <DialogTitle className="user-account-dialog__title">{title}</DialogTitle>
          <div className="user-account-divider" aria-hidden="true" />
          <DialogDescription
            id="user-account-dialog-description"
            className="user-account-dialog__description"
          >
            {description}
          </DialogDescription>
        </DialogHeader>

        {isConfirmStage ? (
          <UserAccountConfirmSection displayName={displayName} error={error} />
        ) : (
          <>
            <UserAccountProfileSection
              displayName={displayName}
              emailLabel={emailLabel}
              initials={initials}
              hasProfile={hasProfile}
              isAuthenticated={isAuthenticated}
              userRole={userRole}
            />
            <Separator />
          </>
        )}

        <DialogFooter className="user-account-dialog__footer">
          {isConfirmStage ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onCancelConfirm}
                disabled={pending}
                className="user-account-dialog__close"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="user-account-dialog__logout user-account-dialog__logout--confirm"
                onClick={() => {
                  void onConfirmLogout();
                }}
                disabled={pending}
                aria-label="Confirm logout"
                ref={confirmButtonRef}
              >
                {pending ? (
                  <>
                    <Loader2 className="user-account-dialog__spinner" aria-hidden="true" />
                    Signing out…
                  </>
                ) : (
                  <>
                    <LogOut className="user-account-dialog__logout-icon" aria-hidden="true" />
                    Logout
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="user-account-dialog__close"
                >
                  Close
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="user-account-dialog__logout"
                onClick={onRequestLogout}
                disabled={pending}
                aria-label="Open logout confirmation"
              >
                <LogOut className="user-account-dialog__logout-icon" aria-hidden="true" />
                Logout
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
