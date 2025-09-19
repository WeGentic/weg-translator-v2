import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { useAuth } from "./contexts/AuthContext";
import { Button } from "./components/ui/button";
import { LogConsole } from "./components/logging/LogConsole";
import { logger } from "./logging";

import "./App.css";
import {
  IPC_EVENT,
  healthCheck,
  listActiveJobs,
  startTranslation,
  subscribeTranslationEvents,
  type AppHealthReport,
  type JobRecord,
  type TranslationCompletedPayload,
  type TranslationFailedPayload,
  type TranslationProgressPayload,
  type TranslationRequest,
  type TranslationStage,
} from "./ipc";

interface TranslationJobViewModel {
  jobId: string;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
  stage: TranslationStage;
  progress: number;
  status: "queued" | "running" | "completed" | "failed";
  message?: string;
  outputText?: string;
  durationMs?: number;
  errorReason?: string;
}

const INITIAL_FORM: TranslationRequest = {
  sourceLanguage: "en",
  targetLanguage: "es",
  text: "",
};

type FormStatus = {
  error: string | null;
};

type LogoutStatus = {
  error: string | null;
};

function extractField(formData: FormData, key: string, fallback: string): string {
  const value = formData.get(key);
  if (typeof value === "string") {
    return value.trim();
  }
  return fallback.trim();
}

function createPlaceholderJob(
  jobId: string,
  overrides?: Partial<TranslationJobViewModel>,
): TranslationJobViewModel {
  return {
    jobId,
    sourceLanguage: overrides?.sourceLanguage ?? "unknown",
    targetLanguage: overrides?.targetLanguage ?? "unknown",
    text: overrides?.text ?? "",
    stage: overrides?.stage ?? "received",
    progress: overrides?.progress ?? 0,
    status: overrides?.status ?? "running",
    message: overrides?.message,
    outputText: overrides?.outputText,
    durationMs: overrides?.durationMs,
    errorReason: overrides?.errorReason,
  };
}

function upsertFromRecord(record: JobRecord): TranslationJobViewModel {
  return createPlaceholderJob(record.jobId, {
    sourceLanguage: record.request.sourceLanguage,
    targetLanguage: record.request.targetLanguage,
    text: record.request.text,
    stage: record.stage,
    progress: record.progress,
    status:
      record.stage === "completed"
        ? "completed"
        : record.stage === "failed"
          ? "failed"
          : "running",
  });
}

function deriveStatusFromStage(stage: TranslationStage): TranslationJobViewModel["status"] {
  if (stage === "completed") return "completed";
  if (stage === "failed") return "failed";
  return "running";
}

function App() {
  const { user, logout: signOut } = useAuth();
  const router = useRouter();
  const [health, setHealth] = useState<AppHealthReport | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [jobs, setJobs] = useState<Record<string, TranslationJobViewModel>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);

  const selectedJob = selectedJobId ? jobs[selectedJobId] : undefined;
  const jobList = useMemo(
    () =>
      Object.values(jobs).sort((a, b) => {
        if (a.status === b.status) {
          return a.jobId.localeCompare(b.jobId);
        }
        const order = ["running", "queued", "completed", "failed"];
        return order.indexOf(a.status) - order.indexOf(b.status);
      }),
    [jobs],
  );

  const mutateJob = useCallback(
    (
      jobId: string,
      derive: (current: TranslationJobViewModel | undefined) => TranslationJobViewModel,
    ) => {
      setJobs((prev) => {
        const next = { ...prev };
        next[jobId] = derive(prev[jobId]);
        return next;
      });
    },
    [],
  );

  const [formStatus, submitTranslation, isSubmitting] = useActionState<FormStatus, FormData>(
    async (_previousState, formData: FormData) => {
      void _previousState;
      setSystemError(null);

      const sourceLanguage = extractField(formData, "sourceLanguage", form.sourceLanguage);
      const targetLanguage = extractField(formData, "targetLanguage", form.targetLanguage);
      const text = extractField(formData, "text", form.text);

      if (sourceLanguage.length <= 1 || targetLanguage.length <= 1 || text.length === 0) {
        return {
          error: "Please provide source language, target language, and text to translate.",
        } satisfies FormStatus;
      }

      if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
        return {
          error: "Source and target languages must be different.",
        } satisfies FormStatus;
      }

      const trimmedRequest: TranslationRequest = {
        sourceLanguage,
        targetLanguage,
        text,
        metadata: form.metadata ?? null,
      };

      try {
        const accepted = await startTranslation(trimmedRequest);

        void logger.info("Translation job accepted", {
          job_id: accepted.jobId,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          queued: accepted.queued,
        });

        mutateJob(accepted.jobId, () =>
          createPlaceholderJob(accepted.jobId, {
            sourceLanguage,
            targetLanguage,
            text,
            status: accepted.queued ? "queued" : "running",
          }),
        );
        setSelectedJobId(accepted.jobId);

        return { error: null } satisfies FormStatus;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to start translation";
        void logger.error("Failed to start translation job", error, {
          source_language: sourceLanguage,
          target_language: targetLanguage,
        });
        return { error: message } satisfies FormStatus;
      }
    },
    { error: null },
  );

  const [logoutStatus, triggerLogout, isLogoutPending] = useActionState<LogoutStatus, FormData>(
    async (_previousState, _formData: FormData) => {
      void _previousState;
      void _formData;
      try {
        await signOut();
        await router.navigate({ to: "/login" });
        return { error: null } satisfies LogoutStatus;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to log out";
        return { error: message } satisfies LogoutStatus;
      }
    },
    { error: null },
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [healthReport, activeJobs] = await Promise.all([
          healthCheck(),
          listActiveJobs(),
        ]);

        if (cancelled) {
          return;
        }

        void logger.info("IPC layer bootstrapped", {
          tracked_jobs: activeJobs.length,
        });

        setHealth(healthReport);

        if (activeJobs.length) {
          setJobs((prev) => {
            const next = { ...prev };
            activeJobs.forEach((record) => {
              next[record.jobId] = upsertFromRecord(record);
            });
            return next;
          });
          setSelectedJobId((prev) => prev ?? activeJobs[0]?.jobId ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Failed to bootstrap IPC layer";
          setSystemError(message);
          void logger.error("Failed to bootstrap IPC layer", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleProgress = useCallback(
    (payload: TranslationProgressPayload) => {
      void logger.debug("Translation progress", {
        job_id: payload.jobId,
        stage: payload.stage,
        progress: `${Math.round(payload.progress * 100)}`,
      });
      mutateJob(payload.jobId, (current) => ({
        ...(current ?? createPlaceholderJob(payload.jobId)),
        stage: payload.stage,
        progress: payload.progress,
        status: deriveStatusFromStage(payload.stage),
        message: payload.message,
      }));
    },
    [mutateJob],
  );

  const handleCompleted = useCallback(
    (payload: TranslationCompletedPayload) => {
      void logger.info("Translation job completed", {
        job_id: payload.jobId,
        duration_ms: payload.durationMs,
      });
      mutateJob(payload.jobId, (current) => ({
        ...(current ?? createPlaceholderJob(payload.jobId)),
        stage: "completed",
        status: "completed",
        progress: 1,
        outputText: payload.outputText,
        durationMs: payload.durationMs,
        message: `Completed in ${payload.durationMs}ms`,
      }));
    },
    [mutateJob],
  );

  const handleFailed = useCallback(
    (payload: TranslationFailedPayload) => {
      void logger.error("Translation job failed", payload.reason, {
        job_id: payload.jobId,
      });
      mutateJob(payload.jobId, (current) => ({
        ...(current ?? createPlaceholderJob(payload.jobId)),
        stage: "failed",
        status: "failed",
        errorReason: payload.reason,
        message: payload.reason,
      }));
    },
    [mutateJob],
  );

  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        cleanup = await subscribeTranslationEvents({
          onProgress: (payload) => isMounted && handleProgress(payload),
          onCompleted: (payload) => isMounted && handleCompleted(payload),
          onFailed: (payload) => isMounted && handleFailed(payload),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to register translation event listeners";
        setSystemError(message);
        void logger.error("Failed to register translation event listeners", error);
      }
    })();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [handleCompleted, handleFailed, handleProgress]);

  const handleSwapLanguages = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      sourceLanguage: prev.targetLanguage,
      targetLanguage: prev.sourceLanguage,
    }));
  }, []);

  const formIsValid =
    form.sourceLanguage.trim().length > 1 &&
    form.targetLanguage.trim().length > 1 &&
    form.text.trim().length > 0 &&
    form.sourceLanguage.trim().toLowerCase() !== form.targetLanguage.trim().toLowerCase();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Weg Translator IPC Playground</h1>
          <p className="muted">
            React ↔︎ Rust communication via Tauri commands ({IPC_EVENT.translationProgress}).
          </p>
        </div>
        <div className="flex items-center gap-4">
          {health && (
            <dl className="health">
              <div>
                <dt>App</dt>
                <dd>{health.appVersion}</dd>
              </div>
              <div>
                <dt>Tauri</dt>
                <dd>{health.tauriVersion}</dd>
              </div>
              <div>
                <dt>Profile</dt>
                <dd>{health.buildProfile}</dd>
              </div>
            </dl>
          )}
          <div className="flex flex-col items-end gap-2">
            {logoutStatus.error && <p className="text-xs text-red-500">{logoutStatus.error}</p>}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.name || user?.email}
              </span>
              <form action={triggerLogout} className="inline-flex">
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  disabled={isLogoutPending}
                >
                  {isLogoutPending ? "Logging out…" : "Logout"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <section className="panel">
        <h2>Request Translation</h2>
        <form className="translation-form" action={submitTranslation}>
          <div className="row">
            <label className="field">
              <span>Source language</span>
              <input
                name="sourceLanguage"
                value={form.sourceLanguage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sourceLanguage: event.target.value }))
                }
                placeholder="e.g. en"
              />
            </label>
            <button
              type="button"
              className="swap"
              onClick={handleSwapLanguages}
              title="Swap languages"
            >
              ⇄
            </button>
            <label className="field">
              <span>Target language</span>
              <input
                name="targetLanguage"
                value={form.targetLanguage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, targetLanguage: event.target.value }))
                }
                placeholder="e.g. es"
              />
            </label>
          </div>

          <label className="field">
            <span>Text</span>
            <textarea
              name="text"
              value={form.text}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, text: event.target.value }))
              }
              rows={4}
              placeholder="Enter text to translate"
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={!formIsValid || isSubmitting}>
              {isSubmitting ? "Submitting…" : "Start translation"}
            </button>
            {(formStatus.error || systemError) && (
              <p className="error">{formStatus.error ?? systemError}</p>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Tracked Jobs</h2>
          <span className="badge">{jobList.length}</span>
        </div>
        {jobList.length === 0 ? (
          <p className="muted">No active jobs yet. Submit a translation to get started.</p>
        ) : (
          <ul className="job-list">
            {jobList.map((job) => (
              <li key={job.jobId}>
                <button
                  className={job.jobId === selectedJobId ? "job-button active" : "job-button"}
                  type="button"
                  onClick={() => setSelectedJobId(job.jobId)}
                >
                  <div className="job-row">
                    <strong>
                      {job.sourceLanguage} → {job.targetLanguage}
                    </strong>
                    <span className={`status status-${job.status}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="job-row">
                    <span className="job-text">{job.text || "(empty)"}</span>
                    <span>{Math.round(job.progress * 100)}%</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Job Details</h2>
          {selectedJob && <span className="badge">{selectedJob.jobId}</span>}
        </div>
        {!selectedJob ? (
          <p className="muted">Select a translation job to see live updates.</p>
        ) : (
          <div className="job-detail">
            <div className="progress">
              <div className="progress-bar" style={{ width: `${selectedJob.progress * 100}%` }} />
            </div>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{selectedJob.status}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{selectedJob.stage}</dd>
              </div>
              {selectedJob.message && (
                <div>
                  <dt>Message</dt>
                  <dd>{selectedJob.message}</dd>
                </div>
              )}
              {selectedJob.durationMs != null && (
                <div>
                  <dt>Duration</dt>
                  <dd>{selectedJob.durationMs} ms</dd>
                </div>
              )}
              {selectedJob.errorReason && (
                <div>
                  <dt>Error</dt>
                  <dd className="error">{selectedJob.errorReason}</dd>
                </div>
              )}
            </dl>

            {selectedJob.outputText && (
              <div className="result">
                <h3>Translated Output</h3>
                <pre>{selectedJob.outputText}</pre>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <LogConsole />
      </section>
    </main>
  );
}

export default App;
