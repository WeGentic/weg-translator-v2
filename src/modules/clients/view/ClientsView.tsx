import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  WizardNewClientDialog,
  type WizardNewClientFormValues,
} from "@/modules/project-manager/components/wizard-v2/components/WizardNewClientDialog";
import "@/shared/styles/main-view.css";
import "@/modules/project-manager/css/data-table.css";
import "./clients-view.css";

import { createClientRecord } from "@/core/ipc/db/clients";
import { toClientViewKey } from "@/app/state/main-view";
import { dispatchClientClear, dispatchClientFocus } from "@/modules/clients/events";
import { useClientsData } from "@/modules/clients/hooks/useClientsData";
import { queueWorkspaceMainView } from "@/modules/workspace/navigation/main-view-persist";
import type { ClientRecord } from "@/shared/types/database";

import { ClientsContent } from "./ClientsContent";
import { ClientsHeader } from "./ClientsHeader";
import { ClientsToolbar } from "./ClientsToolbar";
import { DeleteClientDialog, type DeleteClientTarget } from "./components/DeleteClientDialog";
import { EditClientDialog } from "./components/EditClientDialog";
import type { ClientRow } from "./components/columns";

export function ClientsView() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialName, setDialogInitialName] = useState("");
  const [dialogKey, setDialogKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<DeleteClientTarget>(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { clients, isLoading, error, refresh, upsertClient, removeClient } = useClientsData({ search });

  useEffect(() => {
    queueWorkspaceMainView("clients");
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "clients" },
      }),
    );
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
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

  const handleRequestEdit = useCallback((row: ClientRow) => {
    setEditTarget(row);
    setEditDialogOpen(true);
  }, []);

  const handleRequestDelete = useCallback((row: ClientRow) => {
    setDeleteTarget({
      id: row.id,
      name: row.name,
      email: row.email ?? null,
    });
    setDeleteDialogOpen(true);
  }, []);

  const handleEditDialogChange = useCallback((open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setEditTarget(null);
    }
  }, []);

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  const handleAfterEdit = useCallback((record: ClientRecord) => {
    upsertClient(record);
  }, [upsertClient]);

  const handleAfterDelete = useCallback((clientUuid: string) => {
    removeClient(clientUuid);
  }, [removeClient]);

  const handleRequestOpen = useCallback((row: ClientRow) => {
    const clientUuid = row.id;
    const clientName = row.name.trim();
    dispatchClientFocus({
      clientUuid,
      clientName: clientName.length > 0 ? clientName : "Client",
    });
    const viewKey = toClientViewKey(clientUuid);
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: {
          view: viewKey,
          clientName: clientName.length > 0 ? clientName : undefined,
        },
      }),
    );
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

  const handleCloseView = useCallback(() => {
    dispatchClientClear();
    queueWorkspaceMainView("dashboard");
    navigate({ to: "/dashboard" }).catch(() => undefined);
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "dashboard" },
      }),
    );
  }, [navigate]);

  return (
    <section
      className="mainview-container"
      aria-labelledby="clients-heading"
      id="clients-view"
      role="region"
    >
      <ClientsHeader onClose={handleCloseView} />
      <ClientsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        onAddClient={handleAddClient}
      />
      <ClientsContent
        clients={clients}
        search={search}
        isLoading={isLoading}
        error={error}
        onRetry={() => {
          void refresh();
        }}
        onRequestOpen={handleRequestOpen}
        onRequestEdit={handleRequestEdit}
        onRequestDelete={handleRequestDelete}
      />
      <WizardNewClientDialog
        key={dialogKey}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        initialName={dialogInitialName}
        onSubmit={handleSubmitNewClient}
      />
      <DeleteClientDialog
        key={deleteTarget?.id ?? "no-client"}
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        target={deleteTarget}
        onAfterDelete={handleAfterDelete}
      />
      <EditClientDialog
        key={editTarget?.id ?? "no-client"}
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogChange}
        target={editTarget}
        onAfterSave={handleAfterEdit}
      />
    </section>
  );
}

export default ClientsView;

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
