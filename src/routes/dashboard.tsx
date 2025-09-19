import { useActionState, useEffect, useTransition } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { useAuth } from "../contexts/AuthContext";
import { LogConsole } from "../components/logging/LogConsole";
import { logger } from "../logging";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({
    context,
    location,
  }: {
    context: { auth?: { isAuthenticated?: boolean } };
    location: { pathname?: string };
  }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.pathname ?? "/dashboard",
        },
      });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isNavigating, startNavigate] = useTransition();
  const [logoutStatus, triggerLogout, isLogoutPending] = useActionState<{ error: string | null }>(
    async (_previousState, _formData) => {
      void _previousState;
      void _formData;
      try {
        await logout();
        await router.navigate({ to: "/login" });
        return { error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to log out";
        return { error: message };
      }
    },
    { error: null },
  );

  const displayName = user?.name || user?.email || "Authenticated user";

  useEffect(() => {
    void logger.info("Viewed dashboard", {
      user_id: user?.id,
      user_email: user?.email,
    });
  }, [user?.email, user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/10 p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,1fr)]">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-3xl">Dashboard</CardTitle>
                <CardDescription>Welcome back, {displayName}.</CardDescription>
              </div>
              <div className="flex flex-col items-stretch gap-2">
                {logoutStatus.error && (
                  <p className="text-xs text-destructive">{logoutStatus.error}</p>
                )}
                <form action={triggerLogout} className="inline-flex">
                  <Button
                    variant="outline"
                    size="sm"
                    type="submit"
                    disabled={isLogoutPending}
                  >
                    {isLogoutPending ? "Logging out…" : "Logout"}
                  </Button>
                </form>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                This is a placeholder dashboard. We&apos;ll surface translation activity, shortcuts,
                and collaboration tools here in upcoming iterations.
              </p>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Next steps</p>
                  <p className="text-sm text-muted-foreground">
                    Jump into the translator to start a new job.
                  </p>
                </div>
                <Button
                  disabled={isNavigating}
                  aria-busy={isNavigating}
                  onClick={() => {
                    startNavigate(() => {
                      void router.navigate({ to: "/" });
                    });
                  }}
                >
                  {isNavigating ? "Opening…" : "Open Translator"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between pb-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">Live System Logs</h2>
                <p className="text-sm text-muted-foreground">
                  Monitor backend ↔︎ frontend activity in real time.
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <LogConsole />
            </div>
          </div>
        </div>

        <Card className="border-dashed border-border/60 bg-card/60 text-muted-foreground">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Coming soon</CardTitle>
            <CardDescription>
              Usage analytics, saved projects, and team workflows will live here.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <PlaceholderItem title="Recent activity" description="Track the jobs you ran." />
            <PlaceholderItem title="Team collaboration" description="Coordinate assignments." />
            <PlaceholderItem title="Automations" description="Schedule batch translations." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlaceholderItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/80 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
