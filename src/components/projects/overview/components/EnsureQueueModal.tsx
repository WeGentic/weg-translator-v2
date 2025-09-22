import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { EnsureConversionsPlan } from "@/ipc";

type EnsureQueueModalProps = {
  plan: EnsureConversionsPlan | null;
  isEnsuring: boolean;
  progress: { current: number; total: number };
  logs: string[];
  summary: { completed: number; failed: number } | null;
  onClose: () => void;
  onStart: () => void | Promise<void>;
  onCancel: () => void;
};

export function EnsureQueueModal({
  plan,
  isEnsuring,
  progress,
  logs,
  summary,
  onClose,
  onStart,
  onCancel,
}: EnsureQueueModalProps) {
  const open = Boolean(plan);
  const totalTasks = plan?.tasks.length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preparing project…</DialogTitle>
          <DialogDescription>
            {totalTasks > 0
              ? `Converting ${totalTasks} file${totalTasks === 1 ? "" : "s"} to XLIFF and validating outputs.`
              : "Converting files to XLIFF and validating outputs."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ProgressBar current={progress.current} total={progress.total} running={isEnsuring} />
          {summary ? (
            <div className="text-xs text-muted-foreground">
              Completed: {summary.completed} • Failed: {summary.failed}
            </div>
          ) : null}
          <div
            className="h-48 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2 text-xs"
            role="log"
            aria-live="polite"
          >
            {logs.map((line, idx) => (
              <div key={`${idx}-${line}`} className="whitespace-pre-wrap text-muted-foreground">
                {line}
              </div>
            ))}
            {logs.length === 0 ? (
              <div className="text-muted-foreground/70">Logs will appear here as conversions run.</div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          {isEnsuring ? (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {!summary ? (
                <Button onClick={() => {
                  void onStart();
                }}>
                  <Loader2 className="mr-2 h-4 w-4" /> Start
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgressBar({ current, total, running }: { current: number; total: number; running: boolean }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">
        {running ? `${current} / ${total}` : total > 0 ? `0 / ${total}` : ""}
      </div>
    </div>
  );
}

export default EnsureQueueModal;
