import { Plus, FileUp } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

/**
 * Dashboard quick actions for Sidebar_two.
 * Provides buttons for creating projects and uploading project files.
 */
export function DashboardQuickActions() {
  const handleCreateProject = () => {
    // Dispatch navigation event to open project wizard
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "projects" },
      })
    );
  };

  const handleCreateFromFile = () => {
    // TODO: Implement file upload/drop zone logic
    console.log("Create project from file");
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Create Project Button */}
      <Button
        variant="default"
        className="w-full justify-start gap-2"
        onClick={handleCreateProject}
      >
        <Plus className="size-4" aria-hidden="true" />
        Create Project
      </Button>

      {/* Create from File Section */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileUp className="size-4" aria-hidden="true" />
            Create from File
          </div>

          {/* File Drop Zone Placeholder */}
          <div
            className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 p-4 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
            onClick={handleCreateFromFile}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("border-primary", "bg-primary/5");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
              handleCreateFromFile();
            }}
          >
            <FileUp className="size-8 text-muted-foreground" aria-hidden="true" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Drop file here or click</p>
              <p className="mt-1">to create a project from an existing file</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
