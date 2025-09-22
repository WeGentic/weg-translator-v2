import { Eye, EyeOff, PanelLeft } from "lucide-react";
import type { SidebarState } from "./WorkspaceSidebar";

import { Button } from "../ui/button";

const SIDEBAR_STATE_LABEL: Record<SidebarState, string> = {
  expanded: "Compact sidebar",
  compact: "Hide sidebar",
  hidden: "Show sidebar",
};

type WorkspaceHeaderProps = {
  displayName: string;
  activeJobCount: number;
  sidebarState: SidebarState;
  onSidebarCycle: () => void;
  onHideHeader: () => void;
  onToggleFooter: () => void;
  isFooterVisible: boolean;
  triggerLogout: (formData: FormData) => void;
  isLogoutPending: boolean;
  logoutError: string | null;
};

export function WorkspaceHeader({
  displayName,
  activeJobCount,
  sidebarState,
  onSidebarCycle,
  onHideHeader,
  onToggleFooter,
  isFooterVisible,
  triggerLogout,
  isLogoutPending,
  logoutError,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSidebarCycle}
          aria-label={SIDEBAR_STATE_LABEL[sidebarState]}
        >
          <PanelLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          {SIDEBAR_STATE_LABEL[sidebarState]}
        </Button>
        <div className="space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workspace
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Translation Workspace</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeJobCount} {activeJobCount === 1 ? "job" : "jobs"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onToggleFooter}>
          {isFooterVisible ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
              Hide footer
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              Show footer
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onHideHeader}>
          <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
          Hide header
        </Button>
        <div className="flex flex-col items-end text-right">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          {logoutError ? (
            <span className="text-xs text-destructive">{logoutError}</span>
          ) : null}
        </div>
        <form action={triggerLogout}>
          <Button
            variant="outline"
            size="sm"
            type="submit"
            disabled={isLogoutPending}
            aria-busy={isLogoutPending}
          >
            {isLogoutPending ? "Logging out…" : "Logout"}
          </Button>
        </form>
      </div>
    </header>
  );
}

export function CollapsedHeaderBar({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur">
      <span className="text-xs text-muted-foreground">Header hidden</span>
      <Button variant="ghost" size="sm" onClick={onExpand}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show header
      </Button>
    </div>
  );
}
