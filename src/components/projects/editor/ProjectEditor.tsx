import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, FileText, Hash, Layers, Languages } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProjectDetails,
  ProjectFileConversionDto,
  ProjectFileDto,
  ProjectListItem,
} from "@/ipc";
import { getProjectDetails, readProjectArtifact } from "@/ipc";
import {
  normalizeJliffArtifacts,
  type JliffRoot,
  type SegmentRow,
  type TagsRoot,
} from "@/lib/jliff";

import { SegmentsTable } from "./SegmentsTable";

type ProjectEditorProps = {
  project: ProjectListItem;
  fileId?: string | null;
};

export function ProjectEditor({ project, fileId }: ProjectEditorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [artifactState, setArtifactState] = useState<EditorArtifactsState>(
    fileId ? { status: "loading", fileId } : { status: "idle" },
  );

  useEffect(() => {
    let cancelled = false;

    const fetchDetails = async () => {
      setIsDetailsLoading(true);
      setDetailsError(null);

      try {
        const projectDetails = await getProjectDetails(project.projectId);
        if (cancelled) {
          return;
        }
        setDetails(projectDetails);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Failed to load project details for the editor.";
        setDetails(null);
        setDetailsError(message);
      } finally {
        if (!cancelled) {
          setIsDetailsLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [project.projectId]);

  useEffect(() => {
    if (fileId) {
      const scrollElement = scrollContainerRef.current;
      if (scrollElement) {
        if (typeof scrollElement.scrollTo === "function") {
          scrollElement.scrollTo({ top: 0, behavior: "auto" });
        } else {
          scrollElement.scrollTop = 0;
        }
      }
    }
  }, [fileId]);

  useEffect(() => {
    let cancelled = false;

    const hydrateArtifacts = async () => {
      if (!fileId) {
        if (!cancelled) {
          setArtifactState({ status: "idle" });
        }
        return;
      }

      if (isDetailsLoading) {
        if (!cancelled) {
          setArtifactState({ status: "loading", fileId });
        }
        return;
      }

      if (detailsError) {
        if (!cancelled) {
          setArtifactState({ status: "error", message: detailsError });
        }
        return;
      }

      if (!details) {
        if (!cancelled) {
          setArtifactState({ status: "error", message: "Project details are not available yet." });
        }
        return;
      }

      const fileEntry = details.files.find((candidate) => candidate.file.id === fileId);
      if (!fileEntry) {
        if (!cancelled) {
          setArtifactState({
            status: "error",
            message: "Selected file is no longer part of this project.",
          });
        }
        return;
      }

      const conversion = selectLatestCompletedConversion(fileEntry.conversions);
      if (!conversion || !conversion.jliffRelPath || !conversion.tagMapRelPath) {
        if (!cancelled) {
          setArtifactState({
            status: "error",
            message: "No completed conversion with stored JLIFF artifacts is available for this file yet.",
          });
        }
        return;
      }

      if (!cancelled) {
        setArtifactState({ status: "loading", fileId });
      }

      try {
        const [jliffRaw, tagMapRaw] = await Promise.all([
          readProjectArtifact(details.id, conversion.jliffRelPath),
          readProjectArtifact(details.id, conversion.tagMapRelPath),
        ]);

        if (cancelled) {
          return;
        }

        const jliff = parseJliff(jliffRaw);
        const tags = parseTagMap(tagMapRaw);

        if (cancelled) {
          return;
        }

        const versionSeed = coerceTimestamp(conversion.updatedAt ?? conversion.completedAt);
        const rows = normalizeJliffArtifacts(jliff, tags, { version: versionSeed });
        const summary = computeSegmentSummary(rows);

        if (cancelled) {
          return;
        }

        setArtifactState({
          status: "ready",
          rows,
          jliff,
          tags,
          summary,
          conversion,
          file: fileEntry.file,
          paths: {
            jliff: conversion.jliffRelPath,
            tagMap: conversion.tagMapRelPath,
          },
          version: versionSeed,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Failed to load translation artifacts for this file.";
        setArtifactState({ status: "error", message });
      }
    };

    void hydrateArtifacts();

    return () => {
      cancelled = true;
    };
  }, [details, detailsError, fileId, isDetailsLoading]);

  const activeFileLabel = useMemo(() => {
    if (!fileId) {
      return null;
    }

    if (artifactState.status === "ready") {
      return artifactState.file.originalName || fileId;
    }

    return fileId;
  }, [artifactState, fileId]);

  const languageSummary = useMemo(() => {
    if (artifactState.status !== "ready") {
      return null;
    }
    return {
      source: artifactState.jliff.Source_language,
      target: artifactState.jliff.Target_language,
    };
  }, [artifactState]);

  const handleTargetSave = useCallback(
    ({
      transunitId,
      newTarget,
    }: {
      rowKey: string;
      transunitId: string;
      newTarget: string;
      updatedAt: string;
    }) => {
      setArtifactState((prev) => {
        if (prev.status !== "ready") {
          return prev;
        }

        let matched = false;
        const updatedTransunits = prev.jliff.Transunits.map((transunit) => {
          if (transunit.transunit_id === transunitId) {
            matched = true;
            return {
              ...transunit,
              Target_translation: newTarget,
            };
          }
          return transunit;
        });

        if (!matched) {
          return prev;
        }

        const updatedJliff: JliffRoot = {
          ...prev.jliff,
          Transunits: updatedTransunits,
        };

        const versionSeed = Date.now();
        const nextRows = normalizeJliffArtifacts(updatedJliff, prev.tags, { version: versionSeed });
        const nextSummary = computeSegmentSummary(nextRows);

        return {
          ...prev,
          jliff: updatedJliff,
          rows: nextRows,
          summary: nextSummary,
          version: versionSeed,
        };
      });
    },
    [],
  );

  const editorBody = (() => {
    if (!fileId) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-foreground">Translation canvas</p>
          <p className="text-sm text-muted-foreground">
            Select a file from the project overview to load it into the editor.
          </p>
        </div>
      );
    }

    if (artifactState.status === "loading") {
      return (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading translation artifacts…
        </div>
      );
    }

    if (artifactState.status === "error") {
      return (
        <Alert variant="destructive" className="h-full justify-center">
          <AlertDescription>{artifactState.message}</AlertDescription>
        </Alert>
      );
    }

    if (artifactState.status === "ready") {
      return (
        <SegmentsTable
          rows={artifactState.rows}
          projectId={project.projectId}
          jliffRelPath={artifactState.paths.jliff}
          onTargetSave={handleTargetSave}
          activeFileId={artifactState.file.id}
        />
      );
    }

    return null;
  })();

  return (
    <div ref={scrollContainerRef} className="flex w-full overflow-y-auto p-6">
      <Card className="w-full rounded-2xl border border-border/60 bg-background/80 shadow-sm">
        <CardHeader className="border-border/60 border-b pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold">Editor workspace</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Focus translations and agent-assisted edits for <span className="font-medium text-foreground">{project.name}</span>.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <MetaPill icon={Hash} label={project.projectId} ariaLabel="Project identifier" />
              <MetaPill
                icon={Layers}
                label={`${project.fileCount} file${project.fileCount === 1 ? "" : "s"}`}
                ariaLabel="File count"
              />
              {languageSummary ? (
                <>
                  <MetaPill
                    icon={Languages}
                    label={`Source ${languageSummary.source || "—"}`}
                    ariaLabel="Source language"
                  />
                  <MetaPill
                    icon={Languages}
                    label={`Target ${languageSummary.target || "—"}`}
                    ariaLabel="Target language"
                  />
                </>
              ) : null}
            </div>
          </div>
          {artifactState.status === "ready" ? (
            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
              <MetricCard label="Segments" value={formatNumber(artifactState.summary.total)} />
              <MetricCard
                label="Untranslated"
                value={formatNumber(artifactState.summary.untranslated)}
                tone={artifactState.summary.untranslated > 0 ? "muted" : "default"}
              />
              <MetricCard
                label="Placeholder mismatches"
                value={formatNumber(artifactState.summary.mismatches)}
                tone={artifactState.summary.mismatches > 0 ? "alert" : "default"}
              />
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
            <header className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Active file
            </header>
            {fileId ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  <span className="inline-flex items-center rounded-md bg-background/80 px-2 py-1 font-mono text-xs text-foreground shadow-sm">
                    {activeFileLabel}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground/90">(ID: {fileId})</span>
                </p>
                {artifactState.status === "ready" ? (
                  <dl className="grid gap-3 text-xs sm:grid-cols-2">
                    <MetaRow label="Source language" value={languageSummary?.source || "—"} />
                    <MetaRow label="Target language" value={languageSummary?.target || "—"} />
                    <MetaRow label="JLIFF path" value={artifactState.paths.jliff} />
                    <MetaRow label="Tag map path" value={artifactState.paths.tagMap} />
                  </dl>
                ) : artifactState.status === "error" ? (
                  <p className="text-sm text-destructive">{artifactState.message}</p>
                ) : artifactState.status === "loading" ? (
                  <p className="text-sm text-muted-foreground">Loading translation artifacts…</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a file from the project overview to load it into the editor.
              </p>
            )}
          </section>

          <section className="min-h-[420px] rounded-xl border border-border/60 bg-background/90 p-6 shadow-inner flex flex-col">
            {editorBody}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectEditor;

type MetaPillProps = {
  icon: typeof FileText;
  label: string;
  ariaLabel: string;
};

function MetaPill({ icon: Icon, label, ariaLabel }: MetaPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1 font-medium text-foreground/80"
      aria-label={ariaLabel}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

type EditorArtifactsState =
  | { status: "idle" }
  | { status: "loading"; fileId: string }
  | { status: "error"; message: string }
  | {
      status: "ready";
      rows: SegmentRow[];
      jliff: JliffRoot;
      tags: TagsRoot;
      summary: SegmentSummary;
      conversion: ProjectFileConversionDto;
      file: ProjectFileDto;
      paths: {
        jliff: string;
        tagMap: string;
      };
      version: number;
    };

interface SegmentSummary {
  total: number;
  untranslated: number;
  mismatches: number;
}

function selectLatestCompletedConversion(conversions: ProjectFileConversionDto[]): ProjectFileConversionDto | null {
  let latest: ProjectFileConversionDto | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const conversion of conversions) {
    if (conversion.status !== "completed") {
      continue;
    }
    if (!conversion.jliffRelPath || !conversion.tagMapRelPath) {
      continue;
    }

    const timestamp = coerceTimestamp(
      conversion.completedAt ?? conversion.updatedAt ?? conversion.createdAt ?? conversion.startedAt,
    );
    if (timestamp > latestTimestamp) {
      latest = conversion;
      latestTimestamp = timestamp;
    }
  }

  return latest;
}

function coerceTimestamp(input?: string): number {
  if (!input) {
    return Date.now();
  }
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function computeSegmentSummary(rows: SegmentRow[]): SegmentSummary {
  let untranslated = 0;
  let mismatches = 0;

  for (const row of rows) {
    if (!row.targetRaw || row.targetRaw.trim().length === 0) {
      untranslated += 1;
    }
    if (row.status !== "ok") {
      mismatches += 1;
    }
  }

  return {
    total: rows.length,
    untranslated,
    mismatches,
  };
}

function parseJliff(raw: string): JliffRoot {
  const jliff = safeParse<JliffRoot>(raw, "JLIFF");
  if (!jliff || !Array.isArray(jliff.Transunits)) {
    throw new Error("JLIFF artifact is missing required Transunits array.");
  }
  return jliff;
}

function parseTagMap(raw: string): TagsRoot {
  const tags = safeParse<TagsRoot>(raw, "tag map");
  if (!tags || !Array.isArray(tags.units)) {
    throw new Error("Tag map artifact is missing required units array.");
  }
  return tags;
}

function safeParse<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error.";
    throw new Error(`Failed to parse ${label} artifact: ${message}`);
  }
}

type MetricCardTone = "default" | "muted" | "alert";

type MetricCardProps = {
  label: string;
  value: string;
  tone?: MetricCardTone;
};

function MetricCard({ label, value, tone = "default" }: MetricCardProps) {
  const toneClassName =
    tone === "alert"
      ? "border-destructive/60 bg-destructive/5 text-destructive"
      : tone === "muted"
        ? "border-border/60 bg-background/60 text-muted-foreground"
        : "border-border/60 bg-background/80 text-foreground";

  return (
    <div className={`rounded-lg border px-3 py-2 shadow-sm ${toneClassName}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

type MetaRowProps = {
  label: string;
  value: string;
};

function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 shadow-sm">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
