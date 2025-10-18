export function ClientsHeader() {
  return (
    <div>
      <header className="dashboard-header-zone" aria-label="Clients header">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground" id="clients-heading">
            Clients
          </h2>
          <p className="text-sm text-muted-foreground" id="clients-subheading">
            Manage organizations and contacts linked to translation projects.
          </p>
        </div>
      </header>
      <div className="sidebar-one__logo-divider" aria-hidden="true" />
    </div>
  );
}
