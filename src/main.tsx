import { StrictMode, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "@/router";
import { ScreenGuard } from "@/app/shell/screen-guard";
import { AppProviders, useAuth } from "@/app/providers";
import type { RouterContext as AppRouterContext } from "@/router/router-context";
import { useShellReadyEmitter } from "@/app/providers/useShellReadyEmitter";
import type { ShellReadyAuthStatus } from "@/core/ipc/splash";
import { TransitionSuspenseFallback } from "@/shared/transitions/TransitionSuspenseFallback";
import { PageTransitionProvider } from "@/shared/transitions/PageTransitionProvider";
import "./App.css";

function RouterInnerWrap({ children }: { children: ReactNode }) {
  return (
    <PageTransitionProvider>
      <Suspense fallback={<TransitionSuspenseFallback />}>{children}</Suspense>
    </PageTransitionProvider>
  );
}

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  } as AppRouterContext,
  InnerWrap: RouterInnerWrap,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  type RouterContext = AppRouterContext;
}

function InnerApp() {
  const auth = useAuth();
  const status = resolveShellReadyStatus(auth);

  useShellReadyEmitter(status);

  if (auth.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth }} />;
}

function resolveShellReadyStatus(auth: ReturnType<typeof useAuth>): ShellReadyAuthStatus {
  if (auth.isLoading) {
    return "loading";
  }

  return auth.isAuthenticated ? "authenticated" : "guest";
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppProviders>
      <ScreenGuard minWidth={768} minHeight={600}>
        <InnerApp />
      </ScreenGuard>
    </AppProviders>
  </StrictMode>,
);
