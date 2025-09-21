import { type ProjectListItem } from "@/ipc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type ProjectOverviewPlaceholderProps = {
  project: ProjectListItem | null;
};

export function ProjectOverviewPlaceholder({ project }: ProjectOverviewPlaceholderProps) {
  if (!project) {
    return (
      <div className="flex w-full items-center justify-center p-6">
        <div className="rounded-xl border border-border/60 bg-background/70 p-8 text-center text-sm text-muted-foreground shadow-sm">
          Select a project from the sidebar to view its workspace.
        </div>
      </div>
    );
  }

  const formattedUpdatedAt = safeFormatDate(project.updatedAt);
  const formattedCreatedAt = safeFormatDate(project.createdAt);

  return (
    <section className="flex w-full flex-col gap-6 overflow-y-auto p-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project</p>
        <h2 className="text-2xl font-semibold text-foreground">{project.name}</h2>
        <p className="text-sm text-muted-foreground">
          A dedicated project workspace is on the way. For now, here is a quick summary.
        </p>
      </div>

      <Card>
        <CardHeader className="border-border/60 border-b pb-4">
          <CardTitle className="text-base font-semibold">Project snapshot</CardTitle>
          <CardDescription>Key details to help you confirm you opened the correct project.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <InfoRow label="Project ID" value={project.projectId} />
          <InfoRow label="Slug" value={project.slug} />
          <InfoRow label="Project type" value={formatProjectType(project.projectType)} />
          <InfoRow label="Status" value={formatProjectStatus(project.status)} />
          <InfoRow label="Files" value={`${project.fileCount}`} />
          <InfoRow label="Last updated" value={formattedUpdatedAt} />
          <InfoRow label="Created" value={formattedCreatedAt} />
        </CardContent>
      </Card>

      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        <p>
          This area will soon host translation workflows, file timelines, and agent activity tailored to
          <span className="ml-1 font-medium text-foreground">{project.name}</span>.
        </p>
        <Separator className="my-4" />
        <p className="text-xs text-muted-foreground/80">
          While we build the full workspace experience, you can keep planning your next steps from here.
        </p>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

function safeFormatDate(isoDate: string) {
  const parsed = Number.isNaN(Date.parse(isoDate)) ? null : new Date(isoDate);
  if (!parsed) return "—";
  return DATE_FORMATTER.format(parsed);
}

function formatProjectType(type: ProjectListItem["projectType"]) {
  if (type === "rag") return "Retrieval-Augmented Generation";
  return "Translation";
}

function formatProjectStatus(status: ProjectListItem["status"]) {
  if (status === "archived") return "Archived";
  return "Active";
}
