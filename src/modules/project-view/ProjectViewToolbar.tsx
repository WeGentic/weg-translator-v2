import "./css/ProjectViewToolbar.css";
import { Button } from "@/shared/ui/button";

/**
 * Placeholder toolbar component. Filtering actions continue to live in the
 * content component until the incremental refactor relocates them.
 */
export function ProjectViewToolbar() {
  return (
    <section className="projectview-toolbar-zone">
      <div className="flex h-full items-center gap-3 px-3">
        <Button type="button" size="sm" className="ml-auto">
          Add File
        </Button>
      </div>
    </section>
  );
}

export default ProjectViewToolbar;
