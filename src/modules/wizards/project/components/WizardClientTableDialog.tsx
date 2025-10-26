import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Check, Loader2, UsersRound, X } from "lucide-react";

import type { ClientRecord } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/class-names";

import "../css/project-wizard-client-table.css";

interface WizardClientTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientRecord[];
  selectedClientUuid: string | null;
  onSelectClient: (client: ClientRecord | null) => void;
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh?: () => void;
}

export function WizardClientTableDialog({
  open,
  onOpenChange,
  clients,
  selectedClientUuid,
  onSelectClient,
  isLoading,
  errorMessage,
  onRefresh,
}: WizardClientTableDialogProps) {
  const [activeClientUuid, setActiveClientUuid] = useState<string | null>(null);
  const [pendingClientUuid, setPendingClientUuid] = useState<string | null>(selectedClientUuid);
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const totalClients = clients.length;
  const hasClients = totalClients > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (hasClients) {
      const fallbackUuid = selectedClientUuid ?? clients[0]?.clientUuid ?? null;
      setActiveClientUuid((current) => {
        if (current && clients.some((client) => client.clientUuid === current)) {
          return current;
        }
        return fallbackUuid;
      });
    } else {
      setActiveClientUuid(null);
      activeRowRef.current = null;
    }
  }, [clients, hasClients, open, selectedClientUuid]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (selectedClientUuid && clients.some((client) => client.clientUuid === selectedClientUuid)) {
      setPendingClientUuid(selectedClientUuid);
      return;
    }
    setPendingClientUuid(null);
  }, [clients, open, selectedClientUuid]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (activeRowRef.current) {
        activeRowRef.current.focus();
        return;
      }
      if (panelRef.current) {
        panelRef.current.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, activeClientUuid, clients]);

  const pendingClient = useMemo<ClientRecord | null>(() => {
    if (!pendingClientUuid) {
      return null;
    }
    return clients.find((client) => client.clientUuid === pendingClientUuid) ?? null;
  }, [clients, pendingClientUuid]);

  const assignedClient = useMemo<ClientRecord | null>(() => {
    if (!selectedClientUuid) {
      return null;
    }
    return clients.find((client) => client.clientUuid === selectedClientUuid) ?? null;
  }, [clients, selectedClientUuid]);
  const pendingMatchesAssigned = useMemo<ClientRecord | null>(() => {
    if (!assignedClient) {
      return null;
    }
    return pendingClientUuid === assignedClient.clientUuid ? assignedClient : null;
  }, [assignedClient, pendingClientUuid]);

  const closeDialog = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleUseClient = useCallback(() => {
    if (pendingClient) {
      onSelectClient(pendingClient);
    } else {
      onSelectClient(null);
    }
    closeDialog(false);
  }, [closeDialog, onSelectClient, pendingClient]);

  const handleRowActivate = useCallback(
    (client: ClientRecord) => {
      setActiveClientUuid(client.clientUuid);
      setPendingClientUuid((current) => (current === client.clientUuid ? null : client.clientUuid));
    },
    [],
  );

  const handleRowDoubleClick = useCallback(
    (client: ClientRecord) => {
      setActiveClientUuid(client.clientUuid);
      setPendingClientUuid(client.clientUuid);
      onSelectClient(client);
      closeDialog(false);
    },
    [closeDialog, onSelectClient],
  );

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, rowIndex: number) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const client = clients[rowIndex];
        if (client) {
          setActiveClientUuid(client.clientUuid);
          setPendingClientUuid((current) => (current === client.clientUuid ? null : client.clientUuid));
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (clients.length === 0) return;
        const nextIndex = (rowIndex + 1) % clients.length;
        setActiveClientUuid(clients[nextIndex]?.clientUuid ?? null);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (clients.length === 0) return;
        const nextIndex = rowIndex - 1 < 0 ? clients.length - 1 : rowIndex - 1;
        setActiveClientUuid(clients[nextIndex]?.clientUuid ?? null);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog(false);
      }
    },
    [clients, closeDialog],
  );

  const handleRefresh = useCallback(() => {
    if (!onRefresh) {
      return;
    }
    void onRefresh();
  }, [onRefresh]);

  const renderContactDetails = useCallback((client: ClientRecord) => {
    const hasEmail = Boolean(client.email?.trim().length);
    const hasPhone = Boolean(client.phone?.trim().length);
    if (!hasEmail && !hasPhone) {
      return <span className="wizard-project-manager-client-table-meta muted">No contact details</span>;
    }
    return (
      <span className="wizard-project-manager-client-table-meta">
        {hasEmail ? <span className="wizard-project-manager-client-table-chip">{client.email}</span> : null}
        {hasPhone ? <span className="wizard-project-manager-client-table-chip">{client.phone}</span> : null}
      </span>
    );
  }, []);

  const descriptionId = "wizard-client-table-dialog-description";

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent
        className={cn("wizard-project-manager-client-table-dialog")}
        aria-describedby={descriptionId}
        hideCloseButton
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          closeDialog(false);
        }}
      >
        <DialogHeader className="wizard-project-manager-client-table-header">
          <div className="wizard-project-manager-client-table-heading">
            <DialogTitle>Select a Client</DialogTitle>
            <DialogDescription id={descriptionId}>
              Pick a saved client to link with your project.
            </DialogDescription>
          </div>
          <div className="wizard-project-manager-client-table-header-actions">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            <DialogClose type="button" className="wizard-project-manager-close" aria-label="Close client table">
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div
          className="wizard-project-manager-client-table-body"
          ref={panelRef}
          tabIndex={-1}
          role="presentation"
        >
          {errorMessage ? (
            <div className="wizard-project-manager-client-table-empty">
              <p className="wizard-project-manager-client-table-empty-title">Unable to load clients.</p>
              <p className="wizard-project-manager-client-table-empty-copy">{errorMessage}</p>
              {onRefresh ? (
                <Button type="button" variant="secondary" size="sm" onClick={handleRefresh}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : hasClients ? (
            <div className="wizard-project-manager-client-table-scroll" role="region" aria-live="polite" aria-label="Saved clients">
              <table className="wizard-project-manager-client-table">
                <caption className="sr-only">List of clients available in your workspace</caption>
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, index) => {
                    const isActive = client.clientUuid === activeClientUuid;
                    const isPending = client.clientUuid === pendingClientUuid;
                    const isAssigned = client.clientUuid === selectedClientUuid;
                    return (
                      <tr
                        key={client.clientUuid}
                        ref={(node) => {
                          if (node && isActive) {
                            activeRowRef.current = node;
                          }
                          if (!node && isActive) {
                            activeRowRef.current = null;
                          }
                        }}
                        tabIndex={0}
                        role="row"
                        aria-selected={isPending}
                        data-state={isPending ? "selected" : undefined}
                        className={cn(
                          "wizard-project-manager-client-table-row",
                          isActive && "is-active",
                          isPending && "is-picked",
                          isAssigned && "is-assigned",
                        )}
                        onClick={() => handleRowActivate(client)}
                        onDoubleClick={() => handleRowDoubleClick(client)}
                        onKeyDown={(event) => handleRowKeyDown(event, index)}
                      >
                        <th scope="row">
                          <div className="wizard-project-manager-client-table-name">
                            <span className="wizard-project-manager-client-table-name-text">{client.name}</span>
                            {isAssigned ? (
                              <span className="wizard-project-manager-client-table-badge" aria-label="Currently assigned">
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                Assigned
                              </span>
                            ) : null}
                            {isPending && !isAssigned ? (
                              <span className="wizard-project-manager-client-table-badge" aria-label="Selected for assignment">
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                Selected
                              </span>
                            ) : null}
                          </div>
                        </th>
                        <td>{renderContactDetails(client)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : isLoading ? (
            <div className="wizard-project-manager-client-table-empty">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <p className="wizard-project-manager-client-table-empty-title">Loading clients…</p>
              <p className="wizard-project-manager-client-table-empty-copy">We are fetching the latest list from your workspace.</p>
            </div>
          ) : (
            <div className="wizard-project-manager-client-table-empty">
              <UsersRound className="wizard-project-manager-client-table-empty-icon" aria-hidden="true" />
              <p className="wizard-project-manager-client-table-empty-title">No clients saved yet</p>
              <p className="wizard-project-manager-client-table-empty-copy">
                Add a new client from the wizard to make them appear here.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="wizard-project-manager-client-table-footer">
          <div className="wizard-project-manager-client-table-selection">
            {pendingClient ? (
              <>
                <span className="wizard-project-manager-client-table-selection-label">Selected:</span>
                <strong className="wizard-project-manager-client-table-selection-name">{pendingClient.name}</strong>
              </>
            ) : pendingMatchesAssigned ? (
              <>
                <span className="wizard-project-manager-client-table-selection-label">Assigned:</span>
                <strong className="wizard-project-manager-client-table-selection-name">{pendingMatchesAssigned.name}</strong>
              </>
            ) : (
              <span className="wizard-project-manager-client-table-selection-placeholder">No client selected</span>
            )}
          </div>
          <div className="wizard-project-manager-client-table-footer-actions">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleUseClient}
              className="wizard-project-manager-client-table-button-confirm"
            >
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
