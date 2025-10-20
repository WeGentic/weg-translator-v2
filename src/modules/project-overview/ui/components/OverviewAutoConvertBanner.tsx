import { Button } from "@/shared/ui/button";

type Props = {
  autoConvertOnOpen: boolean;
};

export function OverviewAutoConvertBanner({ autoConvertOnOpen }: Props) {
  if (autoConvertOnOpen) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
      <div>Auto-convert on open is disabled. Conversions will not start automatically.</div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "settings" } }))}
      >
        Open settings
      </Button>
    </div>
  );
}

export default OverviewAutoConvertBanner;

