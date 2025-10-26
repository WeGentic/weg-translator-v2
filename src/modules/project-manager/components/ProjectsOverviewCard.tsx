import "./css/projects-overview-card.css";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export interface ProjectsOverviewCardProps {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  recentlyUpdated: number;
}

export function ProjectsOverviewCard({
  totalProjects,
  activeProjects,
  totalFiles,
  recentlyUpdated,
}: ProjectsOverviewCardProps) {
  const metrics = [
    {
      key: "total-projects",
      label: "Projects",
      value: numberFormatter.format(Math.max(0, totalProjects)),
      hint: "Tracked across the workspace",
    },
    {
      key: "active-projects",
      label: "Active",
      value: numberFormatter.format(Math.max(0, activeProjects)),
      hint: "Currently running or in review",
    },
    {
      key: "total-files",
      label: "Files",
      value: numberFormatter.format(Math.max(0, totalFiles)),
      hint: "Language assets linked to projects",
    },
    {
      key: "recently-updated",
      label: "Updated (24h)",
      value: numberFormatter.format(Math.max(0, recentlyUpdated)),
      hint: "Projects touched in the last day",
    },
  ];

  return (
    <div aria-label="Projects overview metrics">
     
    </div>
  );
}
