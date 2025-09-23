import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectListItem } from "@/ipc";
import { FileText, Hash, Layers } from "lucide-react";

type ProjectEditorProps = {
  project: ProjectListItem;
  fileId?: string | null;
};

export function ProjectEditor({ project, fileId }: ProjectEditorProps) {
  return (
    <div className="flex w-full overflow-y-auto p-6">
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
              <MetaPill icon={Layers} label={`${project.fileCount} file${project.fileCount === 1 ? "" : "s"}`} ariaLabel="File count" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
            <header className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Active file
            </header>
            <p className="text-sm text-muted-foreground">
              {fileId ? (
                <span className="inline-flex items-center rounded-md bg-background/80 px-2 py-1 font-mono text-xs text-foreground shadow-sm">
                  {fileId}
                </span>
              ) : (
                "Select a file from the project overview to load it into the editor."
              )}
            </p>
          </section>

          <section className="min-h-[340px] rounded-xl border border-border/60 bg-background/90 p-6 shadow-inner">
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-foreground">Translation canvas</p>
              <p className="text-sm text-muted-foreground">
                Editing tools, AI suggestions, and translation memory will render here in upcoming iterations.
              </p>
            </div>
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
