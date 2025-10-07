import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "@/router";
import { ScreenGuard } from "@/app/shell/screen-guard";
import { AppProviders, useAuth } from "@/app/providers";
import "./App.css";

interface RouterContext {
  auth: ReturnType<typeof useAuth>;
}

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  } as RouterContext,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface RouterContext {
    auth: ReturnType<typeof useAuth>;
  }
}

function InnerApp() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth }} />;
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
