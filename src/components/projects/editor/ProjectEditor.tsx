import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectListItem } from "@/ipc";

type ProjectEditorProps = {
  project: ProjectListItem;
  fileId?: string | null;
};

export function ProjectEditor({ project, fileId }: ProjectEditorProps) {
  return (
    <div className="flex w-full overflow-y-auto p-6">
      <Card className="w-full">
        <CardHeader className="border-border/60 border-b pb-4">
          <CardTitle className="text-base font-semibold">Editor — {project.name}</CardTitle>
          <CardDescription className="text-xs">
            {project.slug}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            <p>
              Project ID: <span className="font-medium text-foreground">{project.projectId}</span>
            </p>
            <p>
              {fileId ? (
                <>
                  Selected file context: <span className="font-medium text-foreground">{fileId}</span>
                </>
              ) : (
                "No file selected. Choose a file from the project overview to focus it here."
              )}
            </p>
          </div>
          <div className="min-h-[320px] rounded-md border border-border/60 bg-background/60 p-6">
            <p className="text-sm text-muted-foreground">
              Editor surface placeholder. Design tooling and translation workflows will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectEditor;
