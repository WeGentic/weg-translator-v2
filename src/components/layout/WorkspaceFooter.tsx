import { Eye, EyeOff } from "lucide-react";

import type { AppHealthReport } from "../../ipc";

import { Button } from "../ui/button";

type WorkspaceFooterProps = {
  health: AppHealthReport | null;
  onHide: () => void;
};

type CollapsedFooterBarProps = {
  onExpand: () => void;
};

export function WorkspaceFooter({ health, onHide }: WorkspaceFooterProps) {
  return (
    <footer className="sticky bottom-0 z-30 flex h-14 w-full items-center justify-between border-t border-border/60 bg-background/90 px-6 text-xs text-muted-foreground backdrop-blur">
      <div className="flex items-center gap-6">
        <FooterMetric label="App" value={health?.appVersion ?? "—"} />
        <FooterMetric label="Tauri" value={health?.tauriVersion ?? "—"} />
        <FooterMetric label="Profile" value={health?.buildProfile ?? "—"} />
      </div>
      <Button variant="ghost" size="sm" onClick={onHide}>
        <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
        Hide footer
      </Button>
    </footer>
  );
}

export function CollapsedFooterBar({ onExpand }: CollapsedFooterBarProps) {
  return (
    <div className="sticky bottom-0 z-30 flex h-10 w-full items-center justify-center border-t border-border/60 bg-background/90 px-4 backdrop-blur">
      <Button variant="ghost" size="sm" onClick={onExpand}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
        Show footer
      </Button>
    </div>
  );
}

function FooterMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
