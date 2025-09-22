import { CircleUser, PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useActionState, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/logging";
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
import type { SidebarState } from "./WorkspaceSidebar";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  title: string;
  onToggleSidebar?: () => void;
  state?: SidebarState;
  className?: string;
  elevated?: boolean;
  hideUser?: boolean;
};

export function AppHeader({
  title,
  onToggleSidebar,
  state,
  className,
  elevated = false,
  hideUser = false,
}: AppHeaderProps) {
  const { user, logout: signOut } = useAuth();
  const router = useRouter();
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

  const ariaLabel: Record<SidebarState, string> = {
    expanded: "Compact sidebar",
    compact: "Hide sidebar",
    hidden: "Show sidebar",
  };

  const Icon = state === "hidden" ? PanelLeftOpen : state === "compact" ? PanelLeftClose : PanelLeft;
  return (
    <header role="banner" className={cn("fixed inset-x-3 top-3 z-50", className)}>
      <div
        className={cn(
          "relative mx-auto flex min-h-[3.5rem] items-center justify-between gap-2 rounded-2xl border border-border/50 bg-background/70 px-2.5 py-2 shadow-lg backdrop-blur",
          "sm:px-4",
          elevated && "ring-1 ring-border/50 shadow-xl",
        )}
      >
        <div className="flex min-w-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label={state ? ariaLabel[state] : "Toggle sidebar"}
            onClick={onToggleSidebar}
            type="button"
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center">
          <h1
            className="truncate text-sm font-medium text-foreground sm:text-base"
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
              onEscapeKeyDown={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
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
                  onClick={(event) => {
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
    </header>
  );
}

export default AppHeader;
