export function DashboardHeader() {
  return (
    <div>
      {/* Header Zone - 54px fixed height */}
      <header className="dashboard-header-zone" aria-label="Dashboard header">
        <h2 className="text-base font-semibold text-foreground">Dashboard</h2>
      </header>
      <div className="sidebar-one__logo-divider" aria-hidden="true" />
    </div>
  );
}
