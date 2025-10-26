"use no memo";

import { useEffect, useState } from "react";

import { updateClientRecord } from "@/core/ipc/db/clients";
import type { ClientRecord } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/class-names";

import type { ClientRow } from "./columns";

export interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ClientRow | null;
  onAfterSave?: (record: ClientRecord) => void;
}

export function EditClientDialog({ open, onOpenChange, target, onAfterSave }: EditClientDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open && target) {
      setName(target.name);
      setEmail(target.email ?? "");
      setPhone(target.phone ?? "");
      setVatNumber(target.vatNumber ?? "");
      setAddress(target.address ?? "");
      setNotes(target.note ?? "");
      setError(null);
      setPending(false);
    }
    if (!open) {
      setError(null);
      setPending(false);
    }
  }, [open, target]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!target) {
      setError("No client selected.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Client name is required.");
      return;
    }

    setPending(true);
    setError(null);

    void (async () => {
      try {
        const updated = await updateClientRecord({
          clientUuid: target.id,
          name: trimmedName,
          email: normalizeOptional(email),
          phone: normalizeOptional(phone),
          vatNumber: normalizeOptional(vatNumber),
          address: normalizeOptional(address),
          note: normalizeOptional(notes),
        });

        if (!updated) {
          throw new Error("Client was not updated.");
        }

        onAfterSave?.(updated);
        onOpenChange(false);
      } catch (cause) {
        const message = cause instanceof Error && cause.message ? cause.message : "Unable to save client.";
        setError(message);
      } finally {
        setPending(false);
      }
    })();
  };

  const disabled = pending || !target;

  const dialogTitle = target ? `Edit client: ${target.name}` : "Edit client";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("wizard-project-manager-client-dialog")}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>Update client details and save your changes.</DialogDescription>
        </DialogHeader>

        <form className="wizard-project-manager-client-form" onSubmit={handleSubmit}>
          <div className="wizard-project-manager-client-body">
            <div className="wizard-project-manager-client-grid">
              <div className="wizard-project-manager-client-field">
                <label className="wizard-project-manager-client-label" htmlFor="edit-client-name">
                  Client name
                </label>
                <Input
                  id="edit-client-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Corporation"
                  required
                  disabled={disabled}
                  autoFocus
                />
              </div>
              <div className="wizard-project-manager-client-field">
                <label className="wizard-project-manager-client-label" htmlFor="edit-client-email">
                  Contact email
                </label>
                <Input
                  id="edit-client-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="hello@company.com"
                  type="email"
                  disabled={disabled}
                />
              </div>
              <div className="wizard-project-manager-client-field">
                <label className="wizard-project-manager-client-label" htmlFor="edit-client-phone">
                  Phone
                </label>
                <Input
                  id="edit-client-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+1 555 555 1234"
                  type="tel"
                  disabled={disabled}
                />
              </div>
              <div className="wizard-project-manager-client-field">
                <label className="wizard-project-manager-client-label" htmlFor="edit-client-vat">
                  VAT number
                </label>
                <Input
                  id="edit-client-vat"
                  value={vatNumber}
                  onChange={(event) => setVatNumber(event.target.value)}
                  placeholder="BE0123456789"
                  disabled={disabled}
                />
              </div>
              <div className="wizard-project-manager-client-field wizard-project-manager-client-field--address">
                <label className="wizard-project-manager-client-label" htmlFor="edit-client-address">
                  Address
                </label>
                <Textarea
                  id="edit-client-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="123 Example Street, City, Country"
                  rows={3}
                  disabled={disabled}
                />
              </div>
              <div className="wizard-project-manager-client-field wizard-project-manager-client-field--notes">
                <label className="wizard-project-manager-client-label" htmlFor="edit-client-notes">
                  Notes
                </label>
                <Textarea
                  id="edit-client-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Internal notes, key contacts, style guides…"
                  rows={4}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          {error ? (
            <p className="wizard-project-manager-client-error" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="wizard-project-manager-client-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
