import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Building2, Mail, MapPin, Phone, StickyNote, UserCircle } from "lucide-react";

import { getClientRecord } from "@/core/ipc/db/clients";
import type { ClientRecord } from "@/shared/types/database";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { dispatchClientClear, dispatchClientFocus } from "@/modules/clients/events";
import { ClientsHeader } from "./ClientsHeader";
import "./client-details-view.css";

export interface ClientDetailsViewProps {
  clientUuid: string;
  onBack?: () => void;
}

type ClientDetailsState =
  | { status: "idle" | "loading" }
  | { status: "success"; client: ClientRecord }
  | { status: "missing" }
  | { status: "error"; message: string };

export function ClientDetailsView({ clientUuid, onBack }: ClientDetailsViewProps) {
  const [state, setState] = useState<ClientDetailsState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    getClientRecord(clientUuid)
      .then((client) => {
        if (cancelled) {
          return;
        }
        if (client) {
          setState({ status: "success", client });
          dispatchClientFocus({
            clientUuid: client.clientUuid,
            clientName: client.name,
          });
        } else {
          setState({ status: "missing" });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unable to load the selected client.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [clientUuid]);

  const client = state.status === "success" ? state.client : null;

  const safeName = useMemo(() => {
    if (!client) {
      return "Client";
    }
    const trimmed = client.name.trim();
    return trimmed.length > 0 ? trimmed : "Client";
  }, [client]);

  const handleBack = useCallback(() => {
    dispatchClientClear();
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "clients" },
      }),
    );
    onBack?.();
  }, [onBack]);

  return (
    <section
      className="mainview-container client-details-view"
      aria-labelledby="client-details-heading"
      id="clients-details-view"
      role="region"
    >
      <ClientsHeader onClose={handleBack} title={safeName} headingId="client-details-heading" />
      <ClientDetailsToolbar />
      <div className="client-details-view__main">
        {state.status === "loading" ? (
          <div className="client-details-view__loading" role="status" aria-live="polite">
            <span className="client-details-view__loading-spinner" aria-hidden="true" />
            Loading client…
          </div>
        ) : null}

        {state.status === "error" ? (
          <Alert variant="destructive" className="client-details-view__alert">
            <AlertTitle>Could not load client</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {state.status === "missing" ? (
          <Alert variant="destructive" className="client-details-view__alert">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Client not found</AlertTitle>
            <AlertDescription>
              The selected client could not be found. It may have been removed or renamed.
            </AlertDescription>
          </Alert>
        ) : null}

        {client ? (
          <div className="client-details-view__content">
            <Card className="client-details-view__card" aria-labelledby="client-details-heading">
              <CardHeader>
                <CardTitle className="client-details-view__card-title">
                  <UserCircle className="size-6" aria-hidden="true" />
                  Account summary
                </CardTitle>
                <CardDescription>Primary details used across projects and invoicing.</CardDescription>
              </CardHeader>
              <CardContent className="client-details-view__grid">
                <DetailRow icon={<Mail className="size-4" aria-hidden="true" />} label="Email">
                  {formatValue(client.email)}
                </DetailRow>
                <DetailRow icon={<Phone className="size-4" aria-hidden="true" />} label="Phone">
                  {formatValue(client.phone)}
                </DetailRow>
                <DetailRow icon={<MapPin className="size-4" aria-hidden="true" />} label="Address">
                  {formatValue(client.address)}
                </DetailRow>
                <DetailRow icon={<Building2 className="size-4" aria-hidden="true" />} label="VAT number">
                  {formatValue(client.vatNumber)}
                </DetailRow>
                <DetailRow icon={<StickyNote className="size-4" aria-hidden="true" />} label="Notes">
                  {formatValue(client.note)}
                </DetailRow>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
      <ClientDetailsFooter />
    </section>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="client-details-view__row">
      <div className="client-details-view__row-icon">{icon}</div>
      <div className="client-details-view__row-content">
        <span className="client-details-view__row-label">{label}</span>
        <span className="client-details-view__row-value">{children}</span>
      </div>
    </div>
  );
}

function formatValue(value?: string | null) {
  if (!value) {
    return <span className="client-details-view__value-placeholder">Not provided</span>;
  }
  return value;
}

function ClientDetailsToolbar() {
  return (
    <div className="dashboard-toolbar-zone client-details-toolbar" role="toolbar" aria-label="Client actions">
      <div className="client-details-toolbar__placeholder" />
    </div>
  );
}

function ClientDetailsFooter() {
  return (
    <footer className="client-details-footer" aria-label="Client footer" />
  );
}
