import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

import { Progress } from "@/shared/ui/progress";

function ensureMatchMediaPolyfill() {
  if (typeof window === "undefined") {
    return;
  }

  const stub = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: stub,
  });
}

ensureMatchMediaPolyfill();

interface FileProcessingOverlayProps {
  visible: boolean;
  messages: readonly string[];
  currentStep: number;
  fileCount: number;
}

const MIN_PROGRESS = 12;

export function FileProcessingOverlay({ visible, messages, currentStep, fileCount }: FileProcessingOverlayProps) {
  const stages = messages.length > 0 ? messages : ["Preparing files..."];
  const stageCount = stages.length;
  const clampedStep = Math.min(Math.max(currentStep, 0), stageCount - 1);
  const rawProgress = stageCount > 0 ? ((clampedStep + 1) / stageCount) * 100 : 100;
  const progress = Math.min(100, Math.max(MIN_PROGRESS, Math.round(rawProgress)));
  const currentMessage = stages[clampedStep] ?? stages[stages.length - 1];
  const upcomingMessage = stages[clampedStep + 1] ?? null;
  const filesLabel = `${fileCount} file${fileCount === 1 ? "" : "s"}`;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="file-processing-overlay"
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-background/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          aria-live="polite"
        >
          <motion.div
            className="pointer-events-auto w-full max-w-lg px-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background/95 via-background/90 to-background/80 p-7 shadow-2xl">
              <div className="pointer-events-none absolute -top-16 -right-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />

              <div className="relative flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground/70">Auto conversion</p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">Preparing your files</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{filesLabel} queued for XLIFF to JLIFF conversion.</p>
                </div>

                <motion.div
                  className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                >
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-primary/50"
                    style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                    aria-hidden
                  />
                  <Loader2 className="h-5 w-5 text-primary" aria-hidden />
                </motion.div>
              </div>

              <div className="relative mt-8 space-y-4" role="status">
                <Progress value={progress} className="h-2 bg-primary/15" />
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>
                    Step {Math.min(clampedStep + 1, stageCount)} of {stageCount}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 text-sm">
                  <p className="font-medium text-primary">{currentMessage}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {upcomingMessage ? `Next: ${upcomingMessage}` : "Finalizing conversion and syncing artifacts."}
                  </p>
                </div>
              </div>

              <div className="relative mt-8 flex items-center justify-between text-xs text-muted-foreground">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {filesLabel}
                </div>
                <span>We'll notify you when everything is ready.</span>
              </div>
            </div>
            <span className="sr-only" role="status">
              Processing {filesLabel}. {currentMessage}
            </span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default FileProcessingOverlay;
