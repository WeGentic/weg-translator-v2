import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/class-names";

export interface WizardNewClientFormValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  vatNumber: string;
  note: string;
}

interface WizardNewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onSubmit: (values: WizardNewClientFormValues) => Promise<void>;
}

export function WizardNewClientDialog({ open, onOpenChange, initialName, onSubmit }: WizardNewClientDialogProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Client name is required.");
      return;
    }
    setPending(true);
    setError(null);
    void (async () => {
      try {
        await onSubmit({
          name: trimmedName,
          email,
          phone,
          address,
          vatNumber,
          note: notes,
        });
        onOpenChange(false);
      } catch (cause: unknown) {
        const message =
          cause instanceof Error && cause.message ? cause.message : "Unable to save client. Try again.";
        setError(message);
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("wizard-v2-client-dialog")}>
        <DialogHeader>
          <DialogTitle>Add new client</DialogTitle>
          <DialogDescription>Provide basic information to create a client profile.</DialogDescription>
        </DialogHeader>
        <form className="wizard-v2-client-form" onSubmit={handleSubmit}>
          <div className="wizard-v2-client-body">
            <div className="wizard-v2-client-grid">
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-name">
                  Client name
                </label>
                <Input
                  id="wizard-v2-client-name"
                  value={name}
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Corporation"
                  required
                />
              </div>
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-email">
                  Contact email
                </label>
                <Input
                  id="wizard-v2-client-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="hello@company.com"
                  type="email"
                />
              </div>
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-phone">
                  Phone
                </label>
                <Input
                  id="wizard-v2-client-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+1 555 555 1234"
                  type="tel"
                />
              </div>
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-vat">
                  VAT number
                </label>
                <Input
                  id="wizard-v2-client-vat"
                  value={vatNumber}
                  onChange={(event) => setVatNumber(event.target.value)}
                  placeholder="BE0123456789"
                />
              </div>
              <div className="wizard-v2-client-field wizard-v2-client-field--address">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-address">
                  Address
                </label>
                <Textarea
                  id="wizard-v2-client-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="123 Example Street, City, Country"
                  rows={3}
                />
              </div>
              <div className="wizard-v2-client-field wizard-v2-client-field--notes">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-notes">
                  Notes
                </label>
                <Textarea
                  id="wizard-v2-client-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Internal notes, key contacts, style guides…"
                  rows={4}
                />
              </div>
            </div>
          </div>
          {error ? (
            <p className="wizard-v2-client-error" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="wizard-v2-client-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
