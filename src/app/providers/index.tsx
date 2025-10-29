import type { PropsWithChildren, ReactElement } from "react";

import { AppErrorBoundary } from "./errors";
import { LogProvider } from "./logging";
import { ToastProvider } from "@/shared/ui/toast";
import { AuthProvider } from "./auth";

export function AppProviders({ children }: PropsWithChildren): ReactElement {
  return (
    <LogProvider>
      <AppErrorBoundary>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </AppErrorBoundary>
    </LogProvider>
  );
}

export { AuthProvider, useAuth } from "./auth";
export { LogProvider } from "./logging";
