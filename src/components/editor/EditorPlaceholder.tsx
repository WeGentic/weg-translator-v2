import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EditorPlaceholderProps = {
  projectName?: string;
};

/**
 * Temporary editor placeholder shown while the redesigned workspace is under construction.
 */
export function EditorPlaceholder({ projectName }: EditorPlaceholderProps) {
  return (
    <div className="flex min-h-[420px] flex-1 items-center justify-center px-6 py-10">
      <Card className="w-full max-w-xl bg-background/70">
        <CardHeader>
          <CardTitle>Editor redesign in progress</CardTitle>
          <CardDescription>
            {projectName
              ? `We're building a new translation workspace for ${projectName}.`
              : "We're building a new translation workspace."} In the meantime, project files remain accessible
            from the Projects panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm text-muted-foreground">
            <p>Thanks for your patience while we finish the next version of the editor experience.</p>
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-6 text-center text-xs uppercase tracking-wide text-muted-foreground/80">
              Future editor canvas placeholder
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
