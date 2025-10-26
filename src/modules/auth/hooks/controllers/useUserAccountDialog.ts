/**
 * Manages the staged user account dialog experience (profile vs confirm) and logout orchestration.
 * Keeps side effects (toasts, router navigation, focus) outside of presentational components.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { useToast } from "@/shared/ui/toast";

import { useAuth } from "@/modules/auth/hooks/useAuth";

export type UserAccountDialogStage = "profile" | "confirm";

export interface UseUserAccountDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface UseUserAccountDialogResult {
  stage: UserAccountDialogStage;
  isConfirmStage: boolean;
  pending: boolean;
  error: string | null;
  displayName: string;
  emailLabel: string;
  initials: string;
  hasProfile: boolean;
  isAuthenticated: boolean;
  title: string;
  description: string;
  confirmButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  handleOpenChange: (nextOpen: boolean) => void;
  handleRequestLogout: () => void;
  handleCancelConfirm: () => void;
  handleConfirmLogout: () => Promise<void>;
}

export function useUserAccountDialog({
  open,
  onOpenChange,
}: UseUserAccountDialogOptions): UseUserAccountDialogResult {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<UserAccountDialogStage>("profile");
  const [error, setError] = useState<string | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const displayName = useMemo(() => user?.name?.trim() || user?.email || "Authenticated user", [user]);
  const emailLabel = user?.email ?? "No email available";
  const initials = useMemo(() => {
    return displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [displayName]);
  const hasProfile = Boolean(user);
  const isConfirmStage = stage === "confirm";

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!pending) {
        onOpenChange(nextOpen);
      }
    },
    [onOpenChange, pending],
  );

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

  const handleRequestLogout = useCallback(() => {
    if (pending) {
      return;
    }
    setError(null);
    setStage("confirm");
  }, [pending]);

  const handleCancelConfirm = useCallback(() => {
    if (pending) {
      return;
    }
    setStage("profile");
    setError(null);
  }, [pending]);

  const handleConfirmLogout = useCallback(async () => {
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
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unexpected error during sign out.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: message,
      });
    } finally {
      setPending(false);
    }
  }, [logout, onOpenChange, router, toast]);

  const title = isConfirmStage ? "Confirm logout" : "User Account";
  const description = isConfirmStage
    ? "You're about to end this session. You'll need to sign in again to keep working."
    : "View your profile information and manage your session.";

  return {
    stage,
    isConfirmStage,
    pending,
    error,
    displayName,
    emailLabel,
    initials,
    hasProfile,
    isAuthenticated,
    title,
    description,
    confirmButtonRef,
    handleOpenChange,
    handleRequestLogout,
    handleCancelConfirm,
    handleConfirmLogout,
  };
}
