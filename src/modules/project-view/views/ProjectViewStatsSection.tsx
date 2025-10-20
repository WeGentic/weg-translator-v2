import { AlertTriangle, BarChart3, CheckCircle2, GaugeCircle } from "lucide-react";

import type { ProjectStatistics } from "@/shared/types/statistics";

type ProjectViewStatsSectionProps = {
  statistics: ProjectStatistics | null;
  updatedLabel: { relative: string; absolute: string } | null;
  isBusy: boolean;
};

export function ProjectViewStatsSection({
  statistics,
  updatedLabel,
  isBusy,
}: ProjectViewStatsSectionProps) {
  if (!statistics) {
    return (
      <section
        className="project-overview__analytics project-overview__analytics--empty"
        aria-live="polite"
      >
        <div className="project-overview__analytics-empty">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden />
          <div>
            <p className="project-overview__analytics-empty-title">
              {isBusy ? "Refreshing project statistics…" : "Statistics not available yet."}
            </p>
            <p className="project-overview__analytics-empty-subtitle">
              Add processable files or run conversions to generate an initial health snapshot.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { totals, conversions, jobs, progress, warnings } = statistics;
  const progressPercent = clampPercent(Math.round(progress.percentComplete));

  const roleBreakdown = [
    { label: "Processable", value: totals.processable },
    { label: "Reference", value: totals.reference },
    { label: "Instructions", value: totals.instructions },
    { label: "Image", value: totals.image },
    { label: "Other", value: totals.other },
  ].filter((entry) => entry.value > 0);

  const warningTotal = warnings.total;

  return (
    <section className="project-overview__analytics" aria-live="polite">
      <header className="project-overview__analytics-header">
        <div>
          <h2>Project health snapshot</h2>
          <p>Monitor conversion throughput, outstanding jobs, and potential blockers.</p>
        </div>
        {updatedLabel ? (
          <span
            className="project-overview__analytics-updated"
            title={updatedLabel.absolute}
          >
            Updated {updatedLabel.relative}
          </span>
        ) : null}
      </header>

      <div className="project-overview__analytics-grid">
        <article className="project-overview__analytics-card project-overview__analytics-card--progress">
          <div className="project-overview__analytics-card-heading">
            <div className="project-overview__analytics-card-title">
              <GaugeCircle className="h-4 w-4" aria-hidden />
              <span>Translation progress</span>
            </div>
            <strong>{progressPercent}%</strong>
          </div>

          <div
            className="project-overview__progress-bar"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="project-overview__progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="project-overview__analytics-meta">
            {formatNumber(progress.filesReady)} of {formatNumber(progress.processableFiles)} files ready
          </p>
          <div className="project-overview__analytics-pills">
            <span className="project-overview__analytics-pill project-overview__analytics-pill--success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Ready {formatNumber(progress.filesReady)}
            </span>
            <span className="project-overview__analytics-pill project-overview__analytics-pill--warning">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Issues {formatNumber(progress.filesWithErrors)}
            </span>
          </div>
        </article>

        <article className="project-overview__analytics-card">
          <div className="project-overview__analytics-card-heading">
            <div className="project-overview__analytics-card-title">
              <BarChart3 className="h-4 w-4" aria-hidden />
              <span>Conversion throughput</span>
            </div>
          </div>

          <dl className="project-overview__analytics-metrics">
            <div>
              <dt>Completed</dt>
              <dd>{formatNumber(conversions.completed)}</dd>
            </div>
            <div>
              <dt>Running</dt>
              <dd>{formatNumber(conversions.running)}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{formatNumber(conversions.pending)}</dd>
            </div>
            <div>
              <dt>Failed</dt>
              <dd>{formatNumber(conversions.failed)}</dd>
            </div>
          </dl>

  <p className="project-overview__analytics-footnote">
            Processed {formatNumber(conversions.segments)} segments · {formatNumber(conversions.tokens)} tokens
          </p>
        </article>

        <article className="project-overview__analytics-card project-overview__analytics-card--warnings">
          <div className="project-overview__analytics-card-heading">
            <div className="project-overview__analytics-card-title">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <span>Warnings &amp; blockers</span>
            </div>
            <strong>{formatNumber(warningTotal)}</strong>
          </div>

          <dl className="project-overview__analytics-metrics project-overview__analytics-metrics--compact">
            <div>
              <dt>Conversion failures</dt>
              <dd>{formatNumber(warnings.failedArtifacts)}</dd>
            </div>
            <div>
              <dt>Job failures</dt>
              <dd>{formatNumber(warnings.failedJobs)}</dd>
            </div>
            <div>
              <dt>Active jobs</dt>
              <dd>{formatNumber(jobs.running + jobs.pending)}</dd>
            </div>
          </dl>

          <div className="project-overview__analytics-roles">
            {roleBreakdown.map((entry) => (
              <span key={entry.label}>
                {entry.label}: {formatNumber(entry.value)}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function formatNumber(value: number | null | undefined) {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  return "—";
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}
