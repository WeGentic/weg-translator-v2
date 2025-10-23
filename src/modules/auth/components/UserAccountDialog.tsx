import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Mail, UserCircle2 } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

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
import { useToast } from "@/shared/ui/toast";

import { useAuth } from "../hooks/useAuth";

import "./css/user-account-dialog.css";

export interface UserAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserAccountDialog({ open, onOpenChange }: UserAccountDialogProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<"profile" | "confirm">("profile");
  const [error, setError] = useState<string | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const displayName = user?.name?.trim() || user?.email || "Authenticated user";
  const emailLabel = user?.email ?? "No email available";
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const hasProfile = Boolean(user);
  const isConfirmStage = stage === "confirm";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!pending) {
      onOpenChange(nextOpen);
    }
  };

  useEffect(() => {
    if (!open) {
      setStage("profile");
      setPending(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (isConfirmStage) {
      confirmButtonRef.current?.focus();
    }
  }, [isConfirmStage]);

  const handleRequestLogout = () => {
    if (pending) return;
    setError(null);
    setStage("confirm");
  };

  const handleCancelConfirm = () => {
    if (pending) return;
    setStage("profile");
    setError(null);
  };

  const handleLogout = async () => {
    setPending(true);
    setError(null);
    try {
      await logout();
      toast({
        title: "Signed out",
        description: "You have been signed out of this session.",
      });
      onOpenChange(false);

      void router.navigate({ to: "/login", search: { redirect: "/" } }).catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error during sign out.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: message,
      });
    } finally {
      setPending(false);
    }
  };

  const title = isConfirmStage ? "Confirm logout" : "User Account";
  const description = isConfirmStage
    ? "You're about to end this session. You'll need to sign in again to keep working."
    : "View your profile information and manage your session.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="user-account-dialog" aria-describedby="user-account-dialog-description">
        <DialogHeader className="user-account-dialog__header">
          <DialogTitle className="user-account-dialog__title">{title}</DialogTitle>
          <div className="user-account-divider" aria-hidden="true" />
          <DialogDescription id="user-account-dialog-description" className="user-account-dialog__description">
            {description}
          </DialogDescription>
        </DialogHeader>

        {isConfirmStage ? (
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
        ) : (
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
            <Separator />
          </>
        )}

        <DialogFooter className="user-account-dialog__footer">
          {isConfirmStage ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelConfirm}
                disabled={pending}
                className="user-account-dialog__close"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="user-account-dialog__logout user-account-dialog__logout--confirm"
                onClick={handleLogout}
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
                <Button type="button" variant="outline" disabled={pending} className="user-account-dialog__close">
                  Close
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="user-account-dialog__logout"
                onClick={handleRequestLogout}
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
