import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { WorkspaceFooter, CollapsedFooterBar } from "./components/layout/WorkspaceFooter";
import {
  WorkspaceHeader,
  CollapsedHeaderBar,
} from "./components/layout/WorkspaceHeader";
import {
  WorkspaceMainContent,
  type TranslationJobViewModel,
} from "./components/layout/WorkspaceMainContent";
import {
  WorkspaceSidebar,
  type SidebarState,
} from "./components/layout/WorkspaceSidebar";
import { useAuth } from "./contexts/AuthContext";
import { logger } from "./logging";

import "./App.css";
import {
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
  const [sidebarState, setSidebarState] = useState<SidebarState>("expanded");
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isFooterVisible, setIsFooterVisible] = useState(true);

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

  const cycleSidebarState = useCallback(() => {
    setSidebarState((prev) => {
      if (prev === "expanded") return "compact";
      if (prev === "compact") return "hidden";
      return "expanded";
    });
  }, []);

  const toggleFooter = useCallback(() => {
    setIsFooterVisible((prev) => !prev);
  }, []);

  const handleHideHeader = useCallback(() => {
    setIsHeaderVisible(false);
  }, []);

  const handleShowHeader = useCallback(() => {
    setIsHeaderVisible(true);
  }, []);

  const handleCreateProject = useCallback(() => {
    void logger.info("Create project placeholder action triggered");
  }, []);

  const handleTranslationFormAction = useCallback(
    (formData: FormData) => {
      void submitTranslation(formData);
    },
    [submitTranslation],
  );

  const handleLogoutFormAction = useCallback(
    (formData: FormData) => {
      void triggerLogout(formData);
    },
    [triggerLogout],
  );

  const formIsValid =
    form.sourceLanguage.trim().length > 1 &&
    form.targetLanguage.trim().length > 1 &&
    form.text.trim().length > 0 &&
    form.sourceLanguage.trim().toLowerCase() !== form.targetLanguage.trim().toLowerCase();

  const displayName = user?.name || user?.email || "Authenticated user";
  const activeJobCount = jobList.length;

  return (
    <div className="flex min-h-screen flex-col bg-background/60">
      {isHeaderVisible ? (
        <WorkspaceHeader
          displayName={displayName}
          activeJobCount={activeJobCount}
          sidebarState={sidebarState}
          onSidebarCycle={cycleSidebarState}
          onHideHeader={handleHideHeader}
          onToggleFooter={toggleFooter}
          isFooterVisible={isFooterVisible}
          triggerLogout={handleLogoutFormAction}
          isLogoutPending={isLogoutPending}
          logoutError={logoutStatus.error}
        />
      ) : (
        <CollapsedHeaderBar onExpand={handleShowHeader} />
      )}

      <div className="flex flex-1 overflow-hidden">
        <WorkspaceSidebar state={sidebarState} onCreateProject={handleCreateProject} />
        <WorkspaceMainContent
          systemError={systemError}
          form={form}
          onFormChange={setForm}
          onSwapLanguages={handleSwapLanguages}
          submitTranslation={handleTranslationFormAction}
          isSubmitting={isSubmitting}
          formStatus={formStatus}
          isFormValid={formIsValid}
          health={health}
          jobList={jobList}
          selectedJobId={selectedJobId}
          selectedJob={selectedJob}
          onSelectJob={setSelectedJobId}
          activeJobCount={activeJobCount}
        />
      </div>

      {isFooterVisible ? (
        <WorkspaceFooter health={health} onHide={() => setIsFooterVisible(false)} />
      ) : (
        <CollapsedFooterBar onExpand={toggleFooter} />
      )}
    </div>
  );
}

export default App;
