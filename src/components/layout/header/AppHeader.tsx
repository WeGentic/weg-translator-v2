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

import { useLayoutSelector } from "@/app/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/logging";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDEMENU_TOGGLE_LABELS = {
  expanded: "Compact sidebar",
  compact: "Hide sidebar",
  hidden: "Show sidebar",
} as const;

const SIDEMENU_TOGGLE_ICONS = {
  expanded: PanelLeft,
  compact: PanelLeftClose,
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
  const cycleSidemenu = useLayoutSelector((state) => state.cycleSidemenu);
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

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-between gap-3 border-b border-border/50 bg-background px-4",
        elevated && "shadow-lg shadow-border/20",
        className,
      )}
      role="banner"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          onClick={() => cycleSidemenu()}
          disabled={!sidemenuInteractive}
          type="button"
        >
          <Icon className="size-5" aria-hidden="true" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <h1
          className="truncate text-base font-medium text-foreground"
          title={title}
          aria-live="polite"
        >
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1">
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
            <AlertDialogOverlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
            <AlertDialogContent
              onEscapeKeyDown={(event) => event.preventDefault()}
              className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/60 bg-popover p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in"
            >
              <div className="flex flex-col space-y-2 text-center sm:text-left">
                <AlertDialogTitle className="text-lg font-semibold text-foreground">
                  Account
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  <div className="space-y-1">
                    <div className="text-foreground">{user?.name ?? "Authenticated user"}</div>
                    <div className="text-muted-foreground/80">{user?.email ?? "—"}</div>
                  </div>
                </AlertDialogDescription>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel
                  className="inline-flex items-center justify-center rounded-md border border-border/60 bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                >
                  Close
                </AlertDialogCancel>
                <Button
                  onClick={() => {
                    setIsUserDialogOpen(false);
                    setIsLogoutConfirmOpen(true);
                  }}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
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
            <AlertDialogOverlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
            <AlertDialogContent className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/60 bg-popover p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in">
              <div className="flex flex-col space-y-2 text-center sm:text-left">
                <AlertDialogTitle className="text-lg font-semibold text-foreground">
                  Log out?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  You will be signed out of this device.
                </AlertDialogDescription>
                {logoutStatus.error ? (
                  <div className="text-sm text-destructive">{logoutStatus.error}</div>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel
                  disabled={isLogoutPending}
                  className="inline-flex items-center justify-center rounded-md border border-border/60 bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isLogoutPending}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
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
