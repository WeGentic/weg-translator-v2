import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectEditorPlaceholderProps = {
  projectId?: string | null;
};

export function ProjectEditorPlaceholder({ projectId }: ProjectEditorPlaceholderProps) {
  return (
    <div className="flex w-full items-center justify-center overflow-y-auto p-6">
      <Card className="w-full max-w-xl rounded-2xl border border-border/60 bg-background/80 shadow-sm">
        <CardHeader className="border-border/60 border-b pb-4">
          <CardTitle className="text-lg font-semibold">Editor unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm text-muted-foreground">
          <p>We could not load the editor context for this selection.</p>
          <p>
            {projectId
              ? `Project ${projectId} is not open yet. Reopen the project from the Projects view to continue editing.`
              : "Select a project from the sidebar or open projects list to begin editing."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectEditorPlaceholder;
