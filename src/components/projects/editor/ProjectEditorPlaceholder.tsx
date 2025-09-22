import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectEditorPlaceholderProps = {
  projectId?: string | null;
};

export function ProjectEditorPlaceholder({ projectId }: ProjectEditorPlaceholderProps) {
  return (
    <div className="flex w-full items-center justify-center overflow-y-auto p-6">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Editor unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
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
