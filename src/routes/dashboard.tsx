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
import { useState } from "react";
import { convert, convertStream } from "../lib/openxliff";
import { OpenXliffPanel } from "@/components/openxliff/OpenXliffPanel";

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
  const [testOutput, setTestOutput] = useState<string>("");
  const [isStreamRunning, setIsStreamRunning] = useState(false);
  const [streamLog, setStreamLog] = useState<string>("");
  const [streamExit, setStreamExit] = useState<string>("");
  const [logoutStatus, triggerLogout, isLogoutPending] = useActionState<{ error: string | null }, FormData>(
    async (_previousState: { error: string | null }, _formData: FormData) => {
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

  const handleTestOpenXliff = () => {
    void (async () => {
      try {
        const res = await convert({ file: "/tmp/dummy.txt", srcLang: "en-US", version: "2.1" });
        setTestOutput(`[code ${res.code}]\n${res.stdout || res.stderr}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run stub";
        setTestOutput(`Error: ${message}`);
      }
    })();
  };

  const handleTestOpenXliffStream = () => {
    if (isStreamRunning) return;
    setStreamLog("");
    setStreamExit("");
    setIsStreamRunning(true);
    void (async () => {
      try {
        const res = await convertStream(
          { file: "/tmp/dummy.txt", srcLang: "en-US", version: "2.1" },
          {
            onStdout: (line) => setStreamLog((prev) => (prev ? `${prev}\n${line}` : line)),
            onStderr: (line) => setStreamLog((prev) => (prev ? `${prev}\n[err] ${line}` : `[err] ${line}`)),
          },
        );
        setStreamExit(`exit code: ${res.code} signal: ${res.signal} ok: ${res.ok}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run stream";
        setStreamExit(`Error: ${message}`);
      } finally {
        setIsStreamRunning(false);
      }
    })();
  };

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
              <Separator />
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleTestOpenXliff}
                >
                  Test OpenXLIFF Sidecars
                </Button>
                <p className="text-xs text-muted-foreground">Runs stub sidecar to verify wiring.</p>
              </div>
              {testOutput && (
                <pre className="mt-2 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-foreground/90">
                  {testOutput}
                </pre>
              )}
              <Separator className="my-4" />
              <div className="flex items-center gap-3">
                <Button
                  variant="default"
                  disabled={isStreamRunning}
                  aria-busy={isStreamRunning}
                  onClick={handleTestOpenXliffStream}
                >
                  {isStreamRunning ? "Running…" : "Test Streaming (convert)"}
                </Button>
                <p className="text-xs text-muted-foreground">Streams stdout/stderr lines from sidecar.</p>
              </div>
              {(streamLog || streamExit) && (
                <div className="mt-2 grid gap-2">
                  {streamLog && (
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-foreground/90">
                      {streamLog}
                    </pre>
                  )}
                  {streamExit && (
                    <div className="rounded-md border bg-muted/30 p-2 text-xs text-foreground/90">
                      {streamExit}
                    </div>
                  )}
                </div>
              )}
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

        <OpenXliffPanel />
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
