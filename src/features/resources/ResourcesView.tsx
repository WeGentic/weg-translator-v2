import { ResourcesHeader } from "./ResourcesHeader";
import { ResourcesToolbar } from "./ResourcesToolbar"
import { ResourcesContent } from "./ResourcesContent";
import "../main-view.css";

export function ResourcesView() {
  return (
    <section className="mainview-container" aria-labelledby="Resources-heading" id="Resources-view" role="region">
    
      <ResourcesHeader />
      <ResourcesToolbar />
      <ResourcesContent />
    </section>
  );
}

export default ResourcesView;
