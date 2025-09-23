import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "destructive";

export interface ToastAction {
  label: string;
  onClick: () => void;
  dismiss?: boolean;
}

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction;
}

interface ToastRecord extends ToastOptions {
  id: string;
}

interface ToastController {
  toasts: ToastRecord[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const DEFAULT_DURATION = 6000;

const ToastContext = createContext<ToastController | null>(null);

function useToastController(): ToastController {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeouts = useRef(new Map<string, number>());
  const idRef = useRef(0);

  const clearTimer = useCallback((id: string) => {
    const handle = timeouts.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    },
    [clearTimer],
  );

  const toast = useCallback(
    ({ id, duration, ...options }: ToastOptions) => {
      const toastId = id ?? `toast-${Date.now()}-${idRef.current++}`;
      const timeout = Math.max(duration ?? DEFAULT_DURATION, 0);

      setToasts((previous) => {
        const filtered = previous.filter((item) => item.id !== toastId);
        const next: ToastRecord = {
          ...options,
          id: toastId,
          variant: options.variant ?? "default",
        };
        const capped = [...filtered, next];
        return capped.slice(-5);
      });

      if (timeout > 0) {
        clearTimer(toastId);
        const handle = window.setTimeout(() => {
          dismiss(toastId);
        }, timeout);
        timeouts.current.set(toastId, handle);
      }

      return toastId;
    },
    [clearTimer, dismiss],
  );

  const clearAll = useCallback(() => {
    timeouts.current.forEach((handle) => window.clearTimeout(handle));
    timeouts.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      timeouts.current.forEach((handle) => window.clearTimeout(handle));
      timeouts.current.clear();
    };
  }, []);

  return useMemo(
    () => ({
      toasts,
      toast,
      dismiss,
      clearAll,
    }),
    [clearAll, dismiss, toast, toasts],
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const controller = useToastController();

  return (
    <ToastContext.Provider value={controller}>
      {children}
      <ToastViewport controller={controller} />
    </ToastContext.Provider>
  );
}

export function useToast(): Pick<ToastController, "toast" | "dismiss" | "clearAll"> {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return {
    toast: context.toast,
    dismiss: context.dismiss,
    clearAll: context.clearAll,
  };
}

function ToastViewport({ controller }: { controller: ToastController }) {
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const node = document.createElement("div");
    node.className = cn(
      "pointer-events-none fixed inset-x-4 bottom-4 z-[9999] flex flex-col items-end gap-3",
      "sm:inset-x-auto sm:right-4",
    );
    document.body.appendChild(node);
    portalRef.current = node;
    return () => {
      document.body.removeChild(node);
      portalRef.current = null;
    };
  }, []);

  if (!portalRef.current) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none flex w-full flex-col items-end gap-3">
      {controller.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dismiss={controller.dismiss} />
      ))}
    </div>,
    portalRef.current,
  );
}

function ToastItem({ toast, dismiss }: { toast: ToastRecord; dismiss: (id: string) => void }) {
  const { id, title, description, variant = "default", action } = toast;

  const handleAction = useCallback(() => {
    if (action) {
      action.onClick();
      if (action.dismiss !== false) {
        dismiss(id);
      }
    }
  }, [action, dismiss, id]);

  return (
    <Alert
      variant={variant === "destructive" ? "destructive" : "default"}
      className="pointer-events-auto relative w-full max-w-sm border border-border/70 bg-background/95 shadow-lg shadow-black/10 backdrop-blur"
    >
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {action ? (
        <div className="col-start-2 mt-2 flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleAction}>
            {action.label}
          </Button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => dismiss(id)}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </Alert>
  );
}
