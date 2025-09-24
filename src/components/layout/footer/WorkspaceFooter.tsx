import { EyeOff } from "lucide-react";

import { useLayoutActions } from "@/app/layout/MainLayout";
import type { AppHealthReport } from "@/ipc";

import { Button } from "@/components/ui/button";

/**
 * Persistently renders health telemetry for the desktop shell and offers a quick hide action.
 */
export function WorkspaceFooter({
  health,
}: {
  health: AppHealthReport | null;
}) {
  const setFooter = useLayoutActions((state) => state.setFooter);

  return (
    <footer className="sticky bottom-0 z-30 flex h-14 w-full items-center justify-between border-t border-border/60 bg-background/90 px-6 text-xs text-muted-foreground backdrop-blur">
      <div className="flex items-center gap-6">
        <FooterMetric label="App" value={health?.appVersion ?? "—"} />
        <FooterMetric label="Tauri" value={health?.tauriVersion ?? "—"} />
        <FooterMetric label="Profile" value={health?.buildProfile ?? "—"} />
      </div>
      <Button variant="ghost" size="sm" type="button" onClick={() => setFooter({ visible: false })}>
        <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
        Hide footer
      </Button>
    </footer>
  );
}

/**
 * Display helper that prints a compact metric block consisting of a label and value.
 */
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
