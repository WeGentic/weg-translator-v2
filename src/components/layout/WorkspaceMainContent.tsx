import { ArrowLeftRight } from "lucide-react";
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import type { Dispatch, SetStateAction } from "react";

import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
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
import { LogConsole } from "../logging/LogConsole";
import {
  DEFAULT_HISTORY_FILTERS,
  HistoryToolbar,
  TranslationHistoryTable,
  type HistoryStatusFilter,
  type TranslationHistoryFilters,
} from "../history";
import { OpenXliffPanel } from "../openxliff/OpenXliffPanel";
import { cn } from "../../lib/utils";
import type { TranslationHistoryRecord } from "../../ipc";
import { useTranslationHistory } from "../../hooks/useTranslationHistory";

import type {
  AppHealthReport,
  TranslationRequest,
  TranslationStage,
} from "../../ipc";

type TranslationJobStatus = "queued" | "running" | "completed" | "failed";

export type TranslationJobViewModel = {
  jobId: string;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
  stage: TranslationStage;
  progress: number;
  status: TranslationJobStatus;
  message?: string;
  outputText?: string;
  durationMs?: number;
  errorReason?: string;
};

const STATUS_STYLE_MAP: Record<TranslationJobStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-primary/10 text-primary",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  failed: "bg-destructive/10 text-destructive",
};

type WorkspaceMainContentProps = {
  systemError: string | null;
  form: TranslationRequest;
  onFormChange: Dispatch<SetStateAction<TranslationRequest>>;
  onSwapLanguages: () => void;
  submitTranslation: (formData: FormData) => void;
  isSubmitting: boolean;
  formStatus: { error: string | null };
  isFormValid: boolean;
  health: AppHealthReport | null;
  jobList: TranslationJobViewModel[];
  selectedJobId: string | null;
  selectedJob?: TranslationJobViewModel;
  onSelectJob: Dispatch<SetStateAction<string | null>>;
  activeJobCount: number;
};

export function WorkspaceMainContent({
  systemError,
  form,
  onFormChange,
  onSwapLanguages,
  submitTranslation,
  isSubmitting,
  formStatus,
  isFormValid,
  health,
  jobList,
  selectedJobId,
  selectedJob,
  onSelectJob,
  activeJobCount,
}: WorkspaceMainContentProps) {
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<TranslationHistoryFilters>(() => ({
    ...DEFAULT_HISTORY_FILTERS,
  }));
  const [selectedHistoryJobId, setSelectedHistoryJobId] = useState<string | null>(null);

  const {
    history: historyRecords,
    isLoading: isHistoryLoading,
    isRefreshing: isHistoryRefreshing,
    isClearing: isHistoryClearing,
    error: historyError,
    lastLoadedAt: historyLastLoadedAt,
    refresh: refreshHistory,
    clearHistory,
  } = useTranslationHistory({ limit: 100 });

  const filteredHistory = useMemo(() => {
    if (historyFilters.statuses.length === 0) {
      return historyRecords;
    }

    const allowed = new Set(historyFilters.statuses);
    return historyRecords.filter((record) => {
      const normalized = normalizeHistoryStatus(record.job.status);
      if (!normalized) {
        return true;
      }
      return allowed.has(normalized);
    });
  }, [historyFilters, historyRecords]);

  const effectiveSelectedHistoryJobId = useMemo(() => {
    if (!filteredHistory.length) {
      return null;
    }

    if (
      selectedHistoryJobId &&
      filteredHistory.some((record) => record.job.jobId === selectedHistoryJobId)
    ) {
      return selectedHistoryJobId;
    }

    return filteredHistory[0]?.job.jobId ?? null;
  }, [filteredHistory, selectedHistoryJobId]);

  const selectedHistoryRecord = useMemo<TranslationHistoryRecord | null>(
    () =>
      filteredHistory.find((record) => record.job.jobId === effectiveSelectedHistoryJobId) ?? null,
    [effectiveSelectedHistoryJobId, filteredHistory],
  );

  const handleRefreshHistory = useCallback(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const handleConfirmClearHistory = useCallback(async () => {
    try {
      await clearHistory();
      setSelectedHistoryJobId(null);
      setIsClearDialogOpen(false);
    } catch {
      // The hook already surfaces the error; keep dialog open for retry.
    }
  }, [clearHistory]);

  const handleHistoryFiltersChange = useCallback((filters: TranslationHistoryFilters) => {
    setHistoryFilters(filters);
  }, []);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="flex min-h-full flex-col gap-6 p-6 pb-24">
        {systemError ? (
          <Alert variant="destructive">
            <AlertDescription>{systemError}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Translation Workspace</CardTitle>
            <CardDescription>
              Compose requests, queue jobs, and monitor translation progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={submitTranslation} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="sourceLanguage">Source language</Label>
                  <Input
                    id="sourceLanguage"
                    name="sourceLanguage"
                    value={form.sourceLanguage}
                    onChange={(event) =>
                      onFormChange((prev) => ({ ...prev, sourceLanguage: event.target.value }))
                    }
                    placeholder="e.g. en"
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-end justify-center pb-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={onSwapLanguages}
                    disabled={isSubmitting}
                    aria-label="Swap languages"
                  >
                    <ArrowLeftRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetLanguage">Target language</Label>
                  <Input
                    id="targetLanguage"
                    name="targetLanguage"
                    value={form.targetLanguage}
                    onChange={(event) =>
                      onFormChange((prev) => ({ ...prev, targetLanguage: event.target.value }))
                    }
                    placeholder="e.g. es"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="text">Text</Label>
                <Textarea
                  id="text"
                  name="text"
                  value={form.text}
                  onChange={(event) => onFormChange((prev) => ({ ...prev, text: event.target.value }))}
                  placeholder="Enter text to translate"
                />
              </div>
              {formStatus.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{formStatus.error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Fill in the fields and submit to kick off a new translation job.
                </p>
                <Button type="submit" disabled={!isFormValid || isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? "Submitting…" : "Start translation"}
                </Button>
              </div>
            </form>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="App version" value={health?.appVersion ?? "—"} />
              <Stat label="Tauri runtime" value={health?.tauriVersion ?? "—"} />
              <Stat label="Build profile" value={health?.buildProfile ?? "—"} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Tracked Jobs</CardTitle>
                <CardDescription>
                  Monitor queued, running, and completed translation requests.
                </CardDescription>
              </div>
              <span className="rounded-full border border-border/60 bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                {activeJobCount} {activeJobCount === 1 ? "job" : "jobs"}
              </span>
            </CardHeader>
            <CardContent>
              {jobList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active jobs yet. Submit a translation to populate the timeline.
                </p>
              ) : (
                <div className="space-y-2">
                  {jobList.map((job) => {
                    const isActive = job.jobId === selectedJobId;
                    return (
                      <button
                        key={job.jobId}
                        type="button"
                        onClick={() => onSelectJob(job.jobId)}
                        className={cn(
                          "w-full rounded-lg border border-transparent bg-muted/40 px-4 py-3 text-left transition hover:bg-muted",
                          isActive && "border-primary/40 bg-primary/10",
                        )}
                      >
                        <div className="flex items-center justify-between text-sm font-medium text-foreground">
                          <span>{job.jobId}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                              STATUS_STYLE_MAP[job.status],
                            )}
                          >
                            {job.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {job.sourceLanguage} → {job.targetLanguage}
                          </span>
                          <span>{Math.round(job.progress * 100)}% complete</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {job.text || "(empty payload)"}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-foreground/70">
                          <span>{job.stage}</span>
                          <span>{job.message}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle>Job Details</CardTitle>
              <CardDescription>
                Inspect live progress and final output from the selected job.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedJob ? (
                <p className="text-sm text-muted-foreground">
                  Select a translation job to see state, progress, and output.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round(selectedJob.progress * 100)}%` }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stat label="Status" value={selectedJob.status} />
                    <Stat label="Stage" value={selectedJob.stage} />
                    <Stat label="Source" value={selectedJob.sourceLanguage} />
                    <Stat label="Target" value={selectedJob.targetLanguage} />
                    {selectedJob.durationMs != null ? (
                      <Stat label="Duration" value={`${selectedJob.durationMs} ms`} />
                    ) : null}
                    {selectedJob.message ? (
                      <Stat label="Message" value={selectedJob.message} />
                    ) : null}
                    {selectedJob.errorReason ? (
                      <Stat label="Error" value={selectedJob.errorReason} tone="destructive" />
                    ) : null}
                  </div>
                  {selectedJob.outputText ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Translated output
                      </p>
                      <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/50 p-3 text-sm text-foreground/90">
                        {selectedJob.outputText}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Translation History</CardTitle>
              <CardDescription>
                Inspect persisted jobs to verify database-backed results.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsHistoryVisible((previous) => !previous)}
            >
              {isHistoryVisible ? "Hide history" : "Show history"}
            </Button>
          </CardHeader>
          {isHistoryVisible ? (
            <CardContent className="space-y-4">
              <HistoryToolbar
                filters={historyFilters}
                onFiltersChange={handleHistoryFiltersChange}
                onRefresh={handleRefreshHistory}
                onRequestClear={() => setIsClearDialogOpen(true)}
                isRefreshing={isHistoryRefreshing}
                isClearing={isHistoryClearing}
                lastUpdatedAt={historyLastLoadedAt}
                canClear={filteredHistory.length > 0}
              />

              {historyError ? (
                <Alert variant="destructive">
                  <AlertDescription>{historyError}</AlertDescription>
                </Alert>
              ) : null}

              <TranslationHistoryTable
                records={filteredHistory}
                isLoading={isHistoryLoading && filteredHistory.length === 0}
                selectedJobId={effectiveSelectedHistoryJobId}
                onSelectRecord={(record) => setSelectedHistoryJobId(record.job.jobId)}
              />

              {selectedHistoryRecord ? (
                <HistoryOutputCard record={selectedHistoryRecord} />
              ) : null}

              <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <AlertDialogPortal>
                  <AlertDialogOverlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
                  <AlertDialogContent className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/60 bg-popover p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in">
                    <div className="flex flex-col space-y-2 text-center sm:text-left">
                      <AlertDialogTitle className="text-lg font-semibold text-foreground">
                        Clear translation history?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-sm text-muted-foreground">
                        This action removes all completed and failed jobs stored in SQLite. You
                        cannot undo this action.
                      </AlertDialogDescription>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <AlertDialogCancel
                        disabled={isHistoryClearing}
                        className="inline-flex items-center justify-center rounded-md border border-border/60 bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={isHistoryClearing}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.preventDefault();
                          void handleConfirmClearHistory();
                        }}
                      >
                        {isHistoryClearing ? "Clearing…" : "Clear history"}
                      </AlertDialogAction>
                    </div>
                  </AlertDialogContent>
                </AlertDialogPortal>
              </AlertDialog>
            </CardContent>
          ) : null}
        </Card>

        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle>Application Logs</CardTitle>
            <CardDescription>Streaming events from the translation runtime.</CardDescription>
          </CardHeader>
          <CardContent className="h-[24rem] overflow-hidden p-0">
            <LogConsole />
          </CardContent>
        </Card>

        <OpenXliffPanel />
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "destructive";
}) {
  const valueClass =
    tone === "destructive"
      ? "text-sm font-semibold text-destructive"
      : "text-sm font-semibold text-foreground";

  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 break-words", valueClass)}>{value}</p>
    </div>
  );
}

function HistoryOutputCard({ record }: { record: TranslationHistoryRecord }) {
  const { job, output } = record;
  const normalizedStatus = normalizeHistoryStatus(job.status);
  const durationLabel = formatHistoryDuration(output?.durationMs);
  const updatedLabel = formatIsoTimestamp(output?.updatedAt ?? job.updatedAt);

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-background/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>Stored output</span>
        <span>{updatedLabel}</span>
      </div>
      {output?.outputText ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-foreground/90">
          {output.outputText}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">No persisted output for this job.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Status"
          value={String(job.status)}
          tone={normalizedStatus === "failed" ? "destructive" : "default"}
        />
        <Stat label="Duration" value={durationLabel} />
        <Stat label="Model" value={output?.modelName ?? "—"} />
      </div>
      {job.failureReason ? (
        <p className="text-sm text-destructive">Failure reason: {job.failureReason}</p>
      ) : null}
    </div>
  );
}

function normalizeHistoryStatus(status: unknown): HistoryStatusFilter | null {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "failed") {
    return normalized;
  }
  return null;
}

function formatHistoryDuration(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  if (value < 1_000) {
    return `${value} ms`;
  }

  const seconds = value / 1_000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} s`;
}

function formatIsoTimestamp(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
