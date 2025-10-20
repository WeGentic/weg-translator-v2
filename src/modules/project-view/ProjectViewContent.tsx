import "./views/ProjectViewPage.css";

import { useMemo, useState } from "react";

import type { ProjectListItem } from "@/core/ipc";
import type { ProjectFileBundle, ProjectLanguagePair } from "@/shared/types/database";
import type { ProjectStatistics } from "@/shared/types/statistics";
import { PROJECT_FILE_ROLE_OPTIONS, type ProjectFileRoleValue } from "./constants";
import { ProjectViewLayout } from "./layout/ProjectViewLayout";
import type { AssetFilters, AssetGrouping } from "./views/ProjectViewAssetFilters";
import { LanguageSubheader } from "./views/language-subheader";
import { ProjectFilesTable } from "./views/files-table";

export type ProjectViewWorkspaceProps = {
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

export type ProjectViewContentProps = ProjectViewWorkspaceProps;

/**
 * Renders the full project overview experience. All existing UI remains here
 * until follow-up refactors distribute responsibilities across the new layout
 * components.
 */
export function ProjectViewContent({
  headingId: providedHeadingId,
  languagePairs,
  files,
  references: _references,
  instructions: _instructions,
  onOpenFile,
  onRegenerateFile,
  onRegenerateFiles,
  onRemoveFile,
  onAddFiles: _onAddFiles,
  isBusy = false,
  onChangeRole,
  statistics: _statistics = null,
}: ProjectViewContentProps) {
  const layoutHeadingId = providedHeadingId ?? "ProjectView-heading";
  const [filters, _setFilters] = useState<AssetFilters>({ search: "", role: "all", status: "all" });
  const [grouping, _setGrouping] = useState<AssetGrouping>("flat");

  const roleOptions = useMemo(() => PROJECT_FILE_ROLE_OPTIONS, []);

  const effectiveLanguagePairs = Array.isArray(languagePairs) ? languagePairs : [];
  return (
    <section className="project-overview__content" aria-labelledby={layoutHeadingId}>
      <LanguageSubheader languagePairs={effectiveLanguagePairs} />
      <ProjectFilesTable
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
    </section>
  );
}

export interface ProjectViewFallbackProps {
  headingId?: string;
}

export function ProjectViewFallback({
  headingId = "ProjectView-heading",
}: ProjectViewFallbackProps = {}) {
  return (
    <ProjectViewLayout
      id="ProjectView-view"
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
    </ProjectViewLayout>
  );
}
