import {
  Save,
  Undo,
  Redo,
  Search,
  Settings,
  Download,
  Upload,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";

/**
 * Editor menu for Sidebar_two.
 * Provides quick access to editor actions and tools.
 */
export function EditorMenu() {
  const handleSave = () => {
    console.log("Save file");
    // TODO: Implement save logic
  };

  const handleUndo = () => {
    console.log("Undo");
    // TODO: Implement undo logic
  };

  const handleRedo = () => {
    console.log("Redo");
    // TODO: Implement redo logic
  };

  const handleFind = () => {
    console.log("Find");
    // TODO: Implement find logic
  };

  const handleExport = () => {
    console.log("Export");
    // TODO: Implement export logic
  };

  const handleImport = () => {
    console.log("Import");
    // TODO: Implement import logic
  };

  const handleEditorSettings = () => {
    console.log("Editor settings");
    // TODO: Implement editor settings logic
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      {/* File Operations */}
      <div className="flex flex-col gap-1">
        <span className="mb-2 text-xs font-medium text-muted-foreground">File</span>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleSave}
        >
          <Save className="size-4" aria-hidden="true" />
          Save
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleExport}
        >
          <Download className="size-4" aria-hidden="true" />
          Export
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleImport}
        >
          <Upload className="size-4" aria-hidden="true" />
          Import
        </Button>
      </div>

      <Separator className="my-2" />

      {/* Edit Operations */}
      <div className="flex flex-col gap-1">
        <span className="mb-2 text-xs font-medium text-muted-foreground">Edit</span>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleUndo}
        >
          <Undo className="size-4" aria-hidden="true" />
          Undo
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleRedo}
        >
          <Redo className="size-4" aria-hidden="true" />
          Redo
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleFind}
        >
          <Search className="size-4" aria-hidden="true" />
          Find
        </Button>
      </div>

      <Separator className="my-2" />

      {/* Editor Settings */}
      <div className="flex flex-col gap-1">
        <span className="mb-2 text-xs font-medium text-muted-foreground">Settings</span>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleEditorSettings}
        >
          <Settings className="size-4" aria-hidden="true" />
          Editor Settings
        </Button>
      </div>
    </div>
  );
}
