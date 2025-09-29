import { Clock, FileText, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProjectDetails, ProjectListItem } from "@/ipc";

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
  style: "short",
});

const DATE_DETAIL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "long",
});

const CREATION_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatRelativeTime(isoDate: string): { relative: string; absolute: string } {
  const parsed = Number.isNaN(Date.parse(isoDate)) ? null : new Date(isoDate);
  if (!parsed) return { relative: "—", absolute: "—" };

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  let relative: string;
  if (diffMinutes < 60) {
    relative = RELATIVE_TIME_FORMATTER.format(-diffMinutes, "minute");
  } else if (diffHours < 24) {
    relative = RELATIVE_TIME_FORMATTER.format(-diffHours, "hour");
  } else if (diffDays < 7) {
    relative = RELATIVE_TIME_FORMATTER.format(-diffDays, "day");
  } else {
    relative = parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return {
    relative,
    absolute: DATE_DETAIL_FORMATTER.format(parsed),
  };
}

function formatCreationDate(isoDate: string): string {
  const parsed = Number.isNaN(Date.parse(isoDate)) ? null : new Date(isoDate);
  if (!parsed) return "—";

  const formatted = CREATION_DATE_FORMATTER.format(parsed);
  // Replace comma with " - " to get "dd/MM/yyyy - hh:mm" format
  return formatted.replace(", ", " - ");
}

type OverviewHeaderProps = {
  project: ProjectListItem;
  details?: ProjectDetails | null;
  autoConvertOnOpen: boolean;
};

export function OverviewHeader({ project, details, autoConvertOnOpen }: OverviewHeaderProps) {
  const fileCount = typeof details?.files?.length === "number" ? details.files.length : project.fileCount;
  const src = details?.defaultSrcLang ?? "";
  const tgt = details?.defaultTgtLang ?? "";
  const updated = formatRelativeTime(project.updatedAt);
  const created = formatCreationDate(project.createdAt);

  return (
    <div className="mx-4 rounded-xl border border-border/40 bg-gradient-to-br from-background/95 via-background/90 to-background/95 p-4 shadow-sm">
      {/* Primary row: Project name + File count */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground" title={project.name}>
            {project.name}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <FileText className="h-3 w-3" />
            {fileCount} file{fileCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {/* Secondary row: Language pair + Dates */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {src && tgt && (
          <Badge variant="outline" className="gap-1.5 font-medium">
            <Languages className="h-3 w-3" />
            {src} → {tgt}
          </Badge>
        )}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Created {created}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground" title={`Updated ${updated.absolute}`}>
          <Clock className="h-3 w-3" />
          Updated {updated.relative}
        </span>
      </div>
    </div>
  );
}

export default OverviewHeader;
