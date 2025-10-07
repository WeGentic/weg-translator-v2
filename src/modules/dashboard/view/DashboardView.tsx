import { DashboardHeader } from "./DashboardHeader";
import { DashboardToolbar } from "./DashboardToolbar";
import { DashboardContent } from "./DashboardContent";
import "@/shared/styles/main-view.css";

export function DashboardView() {
  return (
    <section
      className="mainview-container"
      aria-labelledby="dashboard-heading"
      id="dashboard-view"
      role="region"
    >
      <DashboardHeader />
      <DashboardToolbar />
      <DashboardContent />
    </section>
  );
}

export default DashboardView;
