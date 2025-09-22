import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectEditorProps = {
  projectId: string;
  fileId?: string | null;
};

export function ProjectEditor({ projectId, fileId }: ProjectEditorProps) {
  return (
    <div className="flex w-full overflow-y-auto p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base">Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Editor view for project <span className="font-medium text-foreground">{projectId}</span>
            {fileId ? (
              <>
                {" "}with file <span className="font-medium text-foreground">{fileId}</span>
              </>
            ) : null}
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectEditor;

