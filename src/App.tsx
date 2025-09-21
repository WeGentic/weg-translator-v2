import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { PanelsTopLeft, FolderKanban, Briefcase, History, Settings, FileText } from "lucide-react";

import { WorkspaceFooter, CollapsedFooterBar } from "./components/layout/WorkspaceFooter";
import { CollapsedHeaderBar } from "./components/layout/WorkspaceHeader";
import { AppHeader } from "./components/layout/AppHeader";
import {
  WorkspaceMainContent,
  type TranslationJobViewModel,
} from "./components/layout/WorkspaceMainContent";
import { type SidebarState } from "./components/layout/WorkspaceSidebar";
import { AppSidebar, type MenuItem } from "./components/layout/AppSidebar";
import { ProjectsPanel } from "./components/projects/ProjectsPanel";
import { ProjectOverviewPlaceholder } from "./components/projects/overview/ProjectOverviewPlaceholder";
import { ProjectOverview } from "./components/projects/overview/ProjectOverview";
import { AppSettingsPanel } from "./components/settings/AppSettingsPanel";
import { useAuth } from "./contexts/AuthContext";
import { logger } from "./logging";
import { useHeaderTitle } from "./hooks/useHeaderTitle";
import { cn } from "./lib/utils";

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
  type ProjectListItem,
} from "./ipc";

const PROJECT_VIEW_PREFIX = "project:" as const;
type ProjectViewKey = `${typeof PROJECT_VIEW_PREFIX}${string}`;
type MainView = "workspace" | "projects" | "jobs" | "history" | "settings" | ProjectViewKey;

function toProjectViewKey(projectId: string): ProjectViewKey {
  // The template string preserves the literal prefix; cast keeps the precise key type for lookups.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return `${PROJECT_VIEW_PREFIX}${projectId}` as ProjectViewKey;
}

function parseProjectIdFromKey(key: string): string | null {
  return key.startsWith(PROJECT_VIEW_PREFIX) ? key.slice(PROJECT_VIEW_PREFIX.length) : null;
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
  const [sidebarState, setSidebarState] = useState<SidebarState>("expanded");
  const [mainView, setMainView] = useState<MainView>("workspace");
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [openProjects, setOpenProjects] = useState<ProjectListItem[]>([]);

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

  // Removed unused create-project placeholder when migrating to AppSidebar

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
  const fixedItems: MenuItem[] = useMemo(
    () => [
      { key: "workspace", label: "Workspace", icon: PanelsTopLeft },
      { key: "projects", label: "Projects", icon: FolderKanban },
      { key: "jobs", label: "Jobs", icon: Briefcase },
      { key: "history", label: "History", icon: History },
      { key: "settings", label: "Settings", icon: Settings },
    ],
    [],
  );

  const handleCloseProject = useCallback(
    (projectId: string) => {
      setOpenProjects((previous) => {
        const next = previous.filter((project) => project.projectId !== projectId);
        setMainView((current) => {
          if (parseProjectIdFromKey(current) === projectId) {
            if (next.length > 0) {
              const fallback = next[next.length - 1];
              return toProjectViewKey(fallback.projectId);
            }
            return "projects";
          }
          return current;
        });
        return next;
      });
    },
    [setMainView],
  );

  const temporaryProjectItems: MenuItem[] = useMemo(
    () =>
      openProjects.map((project) => ({
        key: toProjectViewKey(project.projectId),
        label: project.name,
        icon: FileText,
        onClose: () => handleCloseProject(project.projectId),
      })),
    [handleCloseProject, openProjects],
  );

  const currentProjectId = useMemo(() => parseProjectIdFromKey(mainView), [mainView]);
  const activeProject = useMemo(() => {
    if (!currentProjectId) return null;
    return openProjects.find((project) => project.projectId === currentProjectId) ?? null;
  }, [currentProjectId, openProjects]);

  const handleOpenProject = useCallback(
    (project: ProjectListItem) => {
      setOpenProjects((previous) => {
        const existingIndex = previous.findIndex((item) => item.projectId === project.projectId);
        if (existingIndex >= 0) {
          const next = [...previous];
          next[existingIndex] = project;
          return next;
        }
        return [...previous, project];
      });
      setMainView(toProjectViewKey(project.projectId));
    },
    [setMainView],
  );

  const headerTitle = useHeaderTitle({
    explicit:
      activeProject?.name ?? fixedItems.find((i) => i.key === mainView)?.label ?? undefined,
  });
  const contentPaddingClass = isHeaderVisible ? "pt-24" : "pt-6";
  const contentLeftPadClass = useMemo(() => {
    if (sidebarState === "expanded") return "pl-64"; // 16rem matches w-64
    if (sidebarState === "compact") return "pl-16"; // 4rem matches w-16
    return "pl-0";
  }, [sidebarState]);

  return (
    <div className="flex min-h-screen flex-col bg-background/60">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only fixed left-3 top-3 z-[60] rounded-md border border-border/60 bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Skip to content
      </a>
      {isHeaderVisible ? (
        <AppHeader
          title={headerTitle}
          onToggleSidebar={cycleSidebarState}
          state={sidebarState}
          hideUser={!user}
        />
      ) : (
        <CollapsedHeaderBar onExpand={handleShowHeader} />
      )}

      <div className={cn("flex flex-1 flex-col", contentPaddingClass)}>
        <AppSidebar
          state={sidebarState}
          fixedItems={fixedItems}
          temporaryItems={temporaryProjectItems}
          selectedKey={mainView}
          onSelect={(key) => setMainView(key as MainView)}
          style={{
            top: isHeaderVisible ? "5rem" : "3.25rem", // header(3.5rem) + gaps vs collapsed bar(2.5rem) + gap
            bottom: isFooterVisible ? "4.25rem" : "3.25rem", // footer(3.5rem)/collapsed(2.5rem) + gap
          }}
        />
        <main id="main-content" role="main" className="contents">
          <div className={cn("flex flex-1 overflow-hidden", contentLeftPadClass)}>
            {mainView === "workspace" ? (
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
            ) : mainView === "projects" ? (
              <ProjectsPanel onOpenProject={handleOpenProject} />
            ) : mainView === "settings" ? (
              <div className="w-full overflow-y-auto p-6">
                <AppSettingsPanel />
              </div>
            ) : currentProjectId ? (
              activeProject ? (
                <ProjectOverview projectSummary={activeProject} />
              ) : (
                <ProjectOverviewPlaceholder project={activeProject} />
              )
            ) : (
              <div className="flex w-full items-center justify-center p-6">
                <div className="rounded-xl border border-border/60 bg-background/70 p-8 text-center text-sm text-muted-foreground shadow-sm">
                  {fixedItems.find((i) => i.key === mainView)?.label} coming soon
                </div>
              </div>
            )}
          </div>
        </main>
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
