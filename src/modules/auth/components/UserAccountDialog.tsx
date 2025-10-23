import { useState } from "react";
import { LogOut, Mail, UserCircle2 } from "lucide-react";
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!pending) {
      onOpenChange(nextOpen);
    }
  };

  const handleLogout = async () => {
    setPending(true);
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
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: message,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="user-account-dialog" aria-describedby="user-account-dialog-description">
        <DialogHeader className="user-account-dialog__header">
          <DialogTitle className="user-account-dialog__title">User Account</DialogTitle>
          <div className="user-account-divider" />
          <DialogDescription id="user-account-dialog-description" className="user-account-dialog__description">
            View your profile information and manage your session.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter className="user-account-dialog__footer">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending} className="user-account-dialog__close">
              Close
            </Button>
          </DialogClose>
          <Button type="button" className="user-account-dialog__logout" onClick={handleLogout} disabled={pending} aria-label="Logout">
            <LogOut className="user-account-dialog__logout-icon" aria-hidden="true" />
            {pending ? "Signing out…" : "Logout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
