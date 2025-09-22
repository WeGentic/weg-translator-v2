import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectDetails, ProjectListItem } from "@/ipc";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type OverviewHeaderProps = {
  project: ProjectListItem;
  details?: ProjectDetails | null;
  onAddFiles: () => void;
  autoConvertOnOpen: boolean;
};

export function OverviewHeader({ project, details, onAddFiles, autoConvertOnOpen }: OverviewHeaderProps) {
  const fileCount = typeof details?.files?.length === "number" ? details!.files.length : project.fileCount;
  const src = details?.defaultSrcLang ?? "";
  const tgt = details?.defaultTgtLang ?? "";
  const created = safeFormatDate(project.createdAt);
  const updated = safeFormatDate(project.updatedAt);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 className="truncate text-xl font-semibold text-foreground" title={project.name}>
          {project.name}
        </h2>
        <div className="text-xs text-muted-foreground">
          <span className="truncate" title={project.slug}>
            {project.slug}
          </span>
          {src && tgt ? <span className="mx-2">•</span> : null}
          {src && tgt ? (
            <span title={`${src} to ${tgt}`}>
              {src} → {tgt}
            </span>
          ) : null}
          <span className="mx-2">•</span>
          <span>{fileCount} file{fileCount === 1 ? "" : "s"}</span>
          <span className="mx-2">•</span>
          <span title={`Created ${created}`}>Created {created}</span>
          <span className="mx-2">•</span>
          <span title={`Updated ${updated}`}>Updated {updated}</span>
        </div>
      </div>
      <div className="shrink-0">
        <Button
          size="sm"
          onClick={onAddFiles}
          title={!autoConvertOnOpen ? "Auto-conversion is disabled; conversions won’t start automatically" : undefined}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add files
        </Button>
      </div>
    </div>
  );
}

function safeFormatDate(isoDate: string) {
  const parsed = Number.isNaN(Date.parse(isoDate)) ? null : new Date(isoDate);
  if (!parsed) return "—";
  return DATE_FORMATTER.format(parsed);
}

export default OverviewHeader;

