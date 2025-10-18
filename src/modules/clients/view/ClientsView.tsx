import { useCallback, useState } from "react";

import {
  WizardNewClientDialog,
  type WizardNewClientFormValues,
} from "@/modules/projects/components/wizard-v2/components/WizardNewClientDialog";
import "@/shared/styles/main-view.css";
import "./clients-view.css";

import { createClientRecord } from "@/core/ipc/db/clients";
import { DEFAULT_CLIENT_FILTER, type ClientsFilterValue } from "@/modules/clients/constants";
import { useClientsData } from "@/modules/clients/hooks/useClientsData";

import { ClientsContent } from "./ClientsContent";
import { ClientsHeader } from "./ClientsHeader";
import { ClientsToolbar } from "./ClientsToolbar";

export function ClientsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientsFilterValue>(DEFAULT_CLIENT_FILTER);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialName, setDialogInitialName] = useState("");
  const [dialogKey, setDialogKey] = useState(0);

  const { clients, isLoading, error, refresh, upsertClient } = useClientsData({ search, filter });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleFilterChange = useCallback((value: ClientsFilterValue) => {
    setFilter(value);
  }, []);

  const handleAddClient = useCallback(() => {
    const nextInitialName = search.trim();
    setDialogInitialName(nextInitialName);
    setDialogKey((current) => current + 1);
    setDialogOpen(true);
  }, [search]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setDialogInitialName("");
    }
  }, []);

  const handleSubmitNewClient = useCallback(async (values: WizardNewClientFormValues) => {
    const payload = {
      name: values.name.trim(),
      email: normalizeOptional(values.email),
      phone: normalizeOptional(values.phone),
      address: normalizeOptional(values.address),
      vatNumber: normalizeOptional(values.vatNumber),
      note: normalizeOptional(values.note),
    };

    const record = await createClientRecord(payload);
    upsertClient(record);
  }, [upsertClient]);

  return (
    <section
      className="mainview-container"
      aria-labelledby="clients-heading"
      aria-describedby="clients-subheading"
      id="clients-view"
      role="region"
    >
      <ClientsHeader />
      <ClientsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        filter={filter}
        onFilterChange={handleFilterChange}
        onAddClient={handleAddClient}
      />
      <ClientsContent
        clients={clients}
        search={search}
        filter={filter}
        isLoading={isLoading}
        error={error}
        onRetry={() => {
          void refresh();
        }}
      />
      <WizardNewClientDialog
        key={dialogKey}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        initialName={dialogInitialName}
        onSubmit={handleSubmitNewClient}
      />
    </section>
  );
}

export default ClientsView;

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
