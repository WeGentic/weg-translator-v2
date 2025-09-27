import { CircleUser, PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useActionState, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Action as AlertDialogAction,
  Cancel as AlertDialogCancel,
  Content as AlertDialogContent,
  Description as AlertDialogDescription,
  Overlay as AlertDialogOverlay,
  Portal as AlertDialogPortal,
  Root as AlertDialog,
  Title as AlertDialogTitle,
} from "@radix-ui/react-alert-dialog";

import { useLayoutSelector, useLayoutStoreApi } from "@/app/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/logging";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "../../css-styles/chrome/header/app-header.css";

const SIDEMENU_TOGGLE_LABELS = {
  expanded: "Compact sidebar",
  compact: "Expand sidebar",
  hidden: "Show sidebar",
} as const;

const SIDEMENU_TOGGLE_ICONS = {
  expanded: PanelLeftClose,
  compact: PanelLeft,
  hidden: PanelLeftOpen,
} as const;

/**
 * Presentation contract for {@link AppHeader}. Optional knobs allow the root App component to
 * configure behaviour without tightly coupling state ownership to the header itself.
 */
type AppHeaderProps = {
  title: string;
  className?: string;
  elevated?: boolean;
  hideUser?: boolean;
};

/**
 * High-level workspace header that surfaces navigation affordances, the current view title, and
 * the authenticated user controls. The component keeps its own surface-level dialogs (account and
 * logout confirmation) to avoid leaking modal plumbing into the App shell.
 */
export function AppHeader({
  title,
  className,
  elevated = false,
  hideUser = false,
}: AppHeaderProps) {
  const { user, logout: signOut } = useAuth();
  const router = useRouter();
  const layoutStore = useLayoutStoreApi();
  const sidemenu = useLayoutSelector((state) => state.sidemenu);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  type LogoutStatus = { error: string | null };
  const [logoutStatus, triggerLogout, isLogoutPending] = useActionState<LogoutStatus, FormData>(
    async (_prev, _formData: FormData) => {
      void _prev;
      void _formData;
      try {
        await signOut();
        await router.navigate({ to: "/login" });
        return { error: null } satisfies LogoutStatus;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to log out";
        void logger.error("Failed to log out from header", error);
        return { error: message } satisfies LogoutStatus;
      }
    },
    { error: null },
  );

  const toggleMode = sidemenu.mode;
  const normalizedMode: "expanded" | "compact" | "hidden" =
    toggleMode === "compact" ? "compact" : toggleMode === "hidden" ? "hidden" : "expanded";
  const Icon = SIDEMENU_TOGGLE_ICONS[normalizedMode];
  const ariaLabel = SIDEMENU_TOGGLE_LABELS[normalizedMode];
  const sidemenuInteractive = sidemenu.mounted || toggleMode !== "unmounted";
  // Cycling the sidemenu via the store ensures we don't leak unbound methods while keeping
  // the selector subscriptions scoped to the stateful parts of the header.
  const handleCycleSidemenu = () => {
    layoutStore.getState().cycleSidemenu();
  };

  return (
    <div
      className={cn("app-header", elevated && "app-header--elevated", className)}
      role="banner"
    >
      <div className="app-header__controls">
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          onClick={handleCycleSidemenu}
          disabled={!sidemenuInteractive}
          type="button"
        >
          <Icon className="size-5" aria-hidden="true" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="app-header__title-container">
        <h1
          className="app-header__title"
          title={title}
          aria-live="polite"
        >
          {title}
        </h1>
      </div>

      <div className="app-header__actions">
        {hideUser ? null : (
          <Button
            variant="outline"
            size="icon"
            aria-label="User"
            type="button"
            onClick={() => setIsUserDialogOpen(true)}
          >
            <CircleUser className="size-5" aria-hidden="true" />
            <span className="sr-only">User</span>
          </Button>
        )}
      </div>

      {/* User Account Dialog */}
        <AlertDialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <AlertDialogPortal>
            <AlertDialogOverlay className="app-header__dialog-overlay" />
            <AlertDialogContent
              onEscapeKeyDown={(event) => event.preventDefault()}
              className="app-header__dialog-content"
            >
              <div className="app-header__dialog-section">
                <AlertDialogTitle className="app-header__dialog-title">
                  Account
                </AlertDialogTitle>
                <AlertDialogDescription className="app-header__dialog-description">
                  <div className="app-header__dialog-user">
                    <div className="app-header__dialog-user-name">{user?.name ?? "Authenticated user"}</div>
                    <div className="app-header__dialog-user-email">{user?.email ?? "—"}</div>
                  </div>
                </AlertDialogDescription>
              </div>
              <div className="app-header__dialog-actions">
                <AlertDialogCancel className="app-header__dialog-button">
                  Close
                </AlertDialogCancel>
                <Button
                  onClick={() => {
                    setIsUserDialogOpen(false);
                    setIsLogoutConfirmOpen(true);
                  }}
                  className="app-header__dialog-primary"
                  type="button"
                >
                  Logout
                </Button>
              </div>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>

      {/* Logout Confirmation */}
        <AlertDialog open={isLogoutConfirmOpen} onOpenChange={setIsLogoutConfirmOpen}>
          <AlertDialogPortal>
            <AlertDialogOverlay className="app-header__dialog-overlay" />
            <AlertDialogContent className="app-header__dialog-content">
              <div className="app-header__dialog-section">
                <AlertDialogTitle className="app-header__dialog-title">
                  Log out?
                </AlertDialogTitle>
                <AlertDialogDescription className="app-header__dialog-description">
                  You will be signed out of this device.
                </AlertDialogDescription>
                {logoutStatus.error ? (
                  <div className="app-header__dialog-error">{logoutStatus.error}</div>
                ) : null}
              </div>
              <div className="app-header__dialog-actions">
                <AlertDialogCancel
                  disabled={isLogoutPending}
                  className="app-header__dialog-button"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isLogoutPending}
                  className="app-header__dialog-primary"
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    event.preventDefault();
                    const data = new FormData();
                    void triggerLogout(data);
                  }}
                >
                  {isLogoutPending ? "Logging out…" : "Logout"}
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>
    </div>
  );
}

export default AppHeader;
