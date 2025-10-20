import "./ProjectOverviewPage.css";

import { Clock, FolderOpen, Languages, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { ProjectListItem } from "@/core/ipc";
import type { ProjectFileBundle, ProjectLanguagePair } from "@/shared/types/database";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Button } from "@/shared/ui/button";
import type { ProjectStatistics } from "@/shared/types/statistics";

import { ProjectWorkspaceLayout } from "../layout/ProjectWorkspaceLayout";
import { ProjectOverviewFilesSection } from "./ProjectOverviewFilesSection";
import { ProjectOverviewResourcesSection } from "./ProjectOverviewResourcesSection";
import {
  ProjectOverviewAssetFilters,
  type AssetFilters,
  type AssetGrouping,
} from "./ProjectOverviewAssetFilters";
import { PROJECT_FILE_ROLE_OPTIONS, type ProjectFileRoleValue } from "../constants";
import { ProjectOverviewStatsSection } from "./ProjectOverviewStatsSection";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, {
  style: "short",
  numeric: "auto",
});

type ActiveProps = {
  fallback?: false;
  headingId?: string;
  summary: ProjectListItem;
  fileCount: number;
  languagePairs?: ProjectLanguagePair[];
  subjectLine: string;
  files: ProjectFileBundle[];
  references: ProjectFileBundle[];
  instructions: ProjectFileBundle[];
  onOpenFile?: (fileUuid: string) => void;
  onRegenerateFile?: (fileUuid: string) => void | Promise<void>;
  onRegenerateFiles?: (fileUuids: string[]) => void | Promise<void>;
  onRemoveFile?: (fileUuid: string) => void;
  onAddFiles?: () => void;
  isBusy?: boolean;
  onChangeRole?: (fileUuid: string, nextRole: ProjectFileRoleValue, storedRelPath: string) => void;
  statistics?: ProjectStatistics | null;
};

type FallbackProps = {
  fallback: true;
  headingId?: string;
};

export type ProjectOverviewPageProps = ActiveProps | FallbackProps;

export function ProjectOverviewPage(props: ProjectOverviewPageProps) {
  if (props.fallback) {
    const headingId = props.headingId ?? "ProjectOverview-heading";
    return (
      <ProjectWorkspaceLayout
        id="ProjectOverview-view"
        ariaLabelledBy={headingId}
        header={
          <header className="border-b border-border/60 bg-background/95 px-6 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <h1 className="text-2xl font-semibold text-foreground" id={headingId}>
              Preparing project workspace
            </h1>
            <p className="text-sm text-muted-foreground">Loading project metadata and workspace modules…</p>
          </header>
        }
      >
        <div className="project-overview__content">
          <div className="project-overview__loading">Preparing project workspace…</div>
        </div>
      </ProjectWorkspaceLayout>
    );
  }

  const headingId = props.headingId ?? "ProjectOverview-heading";
  const {
    summary,
    fileCount,
    languagePairs = [],
    subjectLine,
    files,
    references,
    instructions,
    onOpenFile,
    onRegenerateFile,
    onRegenerateFiles,
    onRemoveFile,
    onAddFiles,
    isBusy = false,
    onChangeRole,
    statistics = null,
  } = props;
  const [filters, setFilters] = useState<AssetFilters>({ search: "", role: "all", status: "all" });
  const [grouping, setGrouping] = useState<AssetGrouping>("flat");

  const roleOptions = useMemo(() => PROJECT_FILE_ROLE_OPTIONS, []);

  const statusOptions = useMemo(() => {
    const unique = new Set<string>();
    files.forEach((bundle) => {
      bundle.artifacts?.forEach((artifact) => {
        if (artifact.status) {
          unique.add(artifact.status.toLowerCase());
        }
      });
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [files]);
  const languageBadges = buildLanguageBadges(languagePairs);
  const updatedAt = formatUpdated(summary.updatedAt);
  const createdAt = formatCreated(summary.createdAt);
  const statusLabel = summary.status ? summary.status.toUpperCase() : "UNKNOWN";
  const typeLabel = summary.projectType ? summary.projectType : "unspecified";
  const stats = statistics ?? null;
  const totals = stats?.totals;
  const progress = stats?.progress;
  const warnings = stats?.warnings;
  const lastActivity = stats?.lastActivity ? formatUpdated(stats.lastActivity) : null;

  const header = (
    <header className="project-overview__hero" aria-labelledby={headingId}>
      <div className="project-overview__hero-header">
        <h1 id={headingId}>{summary.name}</h1>
        <div className="project-overview__hero-badges">
          <Badge variant="secondary" className="uppercase tracking-[0.15em]">
            {statusLabel}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {typeLabel}
          </Badge>
          {summary.clientName ? (
            <Badge variant="outline" className="gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {summary.clientName}
            </Badge>
          ) : null}
        </div>
      </div>

      <Separator className="bg-border/60" />

      <div className="project-overview__meta">
        <span title={updatedAt.absolute}>
          <Clock className="h-3.5 w-3.5" />
          Updated {updatedAt.relative}
        </span>
        <span>
          <Clock className="h-3.5 w-3.5" />
          Created {createdAt}
        </span>
        {languageBadges.length > 0 ? (
          <span className="project-overview__language-badges">
            <Languages className="h-3.5 w-3.5" aria-hidden />
            {languageBadges.map((text) => (
              <Badge key={text} variant="outline">
                {text}
              </Badge>
            ))}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Focus areas: <span className="font-medium text-foreground">{subjectLine}</span>
      </p>
    </header>
  );

  const heroStats = (
    <div className="project-overview__stats">
      <StatCard label="Total files" value={formatNumber(totals?.total ?? fileCount)} />
      <StatCard label="Ready files" value={formatNumber(progress?.filesReady)} />
      <StatCard
        label="Files with issues"
        value={formatNumber(progress?.filesWithErrors ?? warnings?.total)}
      />
      <StatCard label="Language pairs" value={formatNumber(languageBadges.length)} />
    </div>
  );

  return (
    <ProjectWorkspaceLayout id="ProjectOverview-view" ariaLabelledBy={headingId} header={header}>
      <div className="project-overview__content">
        {heroStats}
        <ProjectOverviewStatsSection
          statistics={stats}
          updatedLabel={lastActivity}
          isBusy={isBusy}
        />

        <ProjectOverviewAssetFilters
          filters={filters}
          onFiltersChange={setFilters}
          grouping={grouping}
          onGroupingChange={setGrouping}
          roleOptions={roleOptions}
          statusOptions={statusOptions}
          actionSlot={
            onAddFiles ? (
              <Button type="button" size="sm" onClick={onAddFiles} disabled={isBusy}>
                Add files
              </Button>
            ) : null
          }
          disabled={isBusy}
        />

        <ProjectOverviewFilesSection
          files={files}
          filters={filters}
          grouping={grouping}
          roleOptions={roleOptions}
          isBusy={isBusy}
          onOpenFile={onOpenFile}
          onRegenerateFile={onRegenerateFile}
          onRegenerateSelection={onRegenerateFiles}
          onRemoveFile={onRemoveFile}
          onChangeRole={onChangeRole}
        />

        <div className="project-overview__resources-grid-wrapper">
          <ProjectOverviewResourcesSection
            title="Reference material"
            description="Glossaries, parallel documents, or brand tone packs that inform translations."
            emptyPlaceholder="No reference files yet. Add brand assets or context documents to accelerate future jobs."
            items={references}
            filters={filters}
            disabled={isBusy}
            onOpen={onOpenFile}
            onRemove={onRemoveFile}
          />
          <ProjectOverviewResourcesSection
            title="Instructions"
            description="Guidelines, reviewer checklists, and agent briefing notes."
            emptyPlaceholder="No instruction notes recorded yet. Capture reviewer expectations or client tone guidance here."
            items={instructions}
            filters={filters}
            disabled={isBusy}
            onOpen={onOpenFile}
            onRemove={onRemoveFile}
          />
        </div>

        <section className="project-overview__section" aria-label="Upcoming analytics">
          <h2 className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-foreground" />
            Coming soon
          </h2>
          <p>
            Detailed translation statistics, agent activity timelines, and quality insights will activate once the backend
            metrics pipeline is ready.
          </p>
        </section>
      </div>
    </ProjectWorkspaceLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="project-overview__stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildLanguageBadges(languagePairs: ProjectLanguagePair[]) {
  if (!languagePairs || languagePairs.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const formatted: string[] = [];
  for (const pair of languagePairs) {
    const key = `${pair.sourceLang}-${pair.targetLang}`;
    if (seen.has(key)) continue;
    seen.add(key);
    formatted.push(`${pair.sourceLang} → ${pair.targetLang}`);
  }
  return formatted;
}

function formatUpdated(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return { relative: "—", absolute: "—" };
  }
  const date = new Date(parsed);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  let relative: string;
  if (diffMs < hourMs) {
    relative = RELATIVE_TIME.format(-Math.round(diffMs / minuteMs), "minute");
  } else if (diffMs < dayMs) {
    relative = RELATIVE_TIME.format(-Math.round(diffMs / hourMs), "hour");
  } else {
    relative = RELATIVE_TIME.format(-Math.round(diffMs / dayMs), "day");
  }
  return { relative, absolute: DATE_FORMATTER.format(date) };
}

function formatCreated(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return "—";
  }
  return DATE_FORMATTER.format(new Date(parsed));
}

function formatNumber(value: number | null | undefined) {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  return "—";
}
