import { CalendarClock, FileText, Languages, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProjectDetails, ProjectListItem } from "@/ipc";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_DETAIL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "long",
});

type OverviewHeaderProps = {
  project: ProjectListItem;
  details?: ProjectDetails | null;
  autoConvertOnOpen: boolean;
};

export function OverviewHeader({ project, details, autoConvertOnOpen }: OverviewHeaderProps) {
  const fileCount = typeof details?.files?.length === "number" ? details.files.length : project.fileCount;
  const src = details?.defaultSrcLang ?? "";
  const tgt = details?.defaultTgtLang ?? "";
  const created = safeFormatDate(project.createdAt);
  const updated = safeFormatDate(project.updatedAt);

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-background/90 via-background/70 to-background/90 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project overview</p>
          <h2 className="truncate text-2xl font-semibold leading-tight text-foreground" title={project.name}>
            {project.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Organise, convert, and fine-tune your translation assets in one place.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <MetaChip icon={FileText} label={`${fileCount} file${fileCount === 1 ? "" : "s"}`} />
        {src && tgt ? <MetaChip icon={Languages} label={`${src} → ${tgt}`} /> : null}
        <MetaChip icon={CalendarClock} label={`Created ${created.label}`} title={`Created ${created.detail}`} />
        <MetaChip icon={CalendarClock} label={`Updated ${updated.label}`} title={`Updated ${updated.detail}`} />
        <MetaChip
          icon={Sparkles}
          label={autoConvertOnOpen ? "Auto convert on open" : "Manual conversions"}
          title="Project conversion automation preference"
        />
      </div>
    </div>
  );
}

function safeFormatDate(isoDate: string) {
  const parsed = Number.isNaN(Date.parse(isoDate)) ? null : new Date(isoDate);
  if (!parsed) return { label: "—", detail: "—" } as const;
  return {
    label: DATE_FORMATTER.format(parsed),
    detail: DATE_DETAIL_FORMATTER.format(parsed),
  } as const;
}

type MetaChipProps = {
  icon: LucideIcon;
  label: string;
  title?: string;
};

function MetaChip({ icon: Icon, label, title }: MetaChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/50 px-3 py-1 font-medium text-foreground/90"
      title={title ?? label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

export default OverviewHeader;
