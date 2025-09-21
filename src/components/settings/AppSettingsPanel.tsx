import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertCircle, CheckCircle2, FolderSymlink, RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getAppSettings, updateAppFolder } from "@/ipc";
import type { AppSettings } from "@/ipc";

const PATH_DESCRIPTIONS = [
  {
    label: "Database file",
    accessor: (settings: AppSettings) => settings.databasePath,
    exists: (settings: AppSettings) => settings.databaseExists,
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  },
  {
    label: "Projects directory",
    accessor: (settings: AppSettings) => settings.projectsPath,
    exists: (settings: AppSettings) => settings.projectsPathExists,
    icon: <FolderSymlink className="h-4 w-4" aria-hidden="true" />,
  },
  {
    label: "Settings file",
    accessor: (settings: AppSettings) => settings.settingsFile,
    exists: (settings: AppSettings) => settings.settingsFileExists,
    icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  },
] as const;

export function AppSettingsPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAppSettings();
      setSettings(data);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : "Failed to load application settings.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleChangeFolder = useCallback(async () => {
    setStatus(null);
    setError(null);

    const selection = await open({ directory: true, multiple: false });
    const nextFolder = Array.isArray(selection) ? selection[0] : selection;
    if (!nextFolder) return;

    setIsUpdating(true);
    try {
      const updated = await updateAppFolder(nextFolder);
      setSettings(updated);
      setStatus("Application folder updated successfully.");
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : "Unable to update the application folder.";
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const derived = useMemo(() => {
    if (!settings) return null;
    return {
      infoRows: PATH_DESCRIPTIONS.map((descriptor) => ({
        label: descriptor.label,
        path: descriptor.accessor(settings),
        exists: descriptor.exists(settings),
        icon: descriptor.icon,
      })),
      isDefault: settings.isUsingDefaultLocation,
    };
  }, [settings]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>Storage configuration</CardTitle>
          <CardDescription>Control where the application stores databases and project files.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {status ? (
            <Alert>
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading application settings…</div>
          ) : settings ? (
            <div className="space-y-6">
              <section className="space-y-3">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Current application folder</p>
                    <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
                      {settings.appFolder}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      {derived?.isDefault
                        ? "Using the default system location."
                        : "Using a custom folder for application data."}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadSettings()}
                      disabled={isUpdating}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleChangeFolder()}
                      disabled={isUpdating}
                      className="flex items-center gap-2"
                    >
                      <FolderSymlink className="h-4 w-4" aria-hidden="true" />
                      Choose folder
                    </Button>
                  </div>
                </header>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    aria-label={settings.appFolderExists ? "Folder exists" : "Folder missing"}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                      settings.appFolderExists ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {settings.appFolderExists ? "Available" : "Not found"}
                  </span>
                  <span>Default location:</span>
                  <code className="break-all text-[11px] text-muted-foreground">
                    {settings.defaultAppFolder}
                  </code>
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <p className="text-sm font-medium text-foreground">Managed resources</p>
                <div className="space-y-2">
                  {derived?.infoRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{row.label}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            row.exists
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {row.exists ? "Available" : "Not found"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        {row.icon}
                        <code className="break-all leading-relaxed">{row.path}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Settings are unavailable.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AppSettingsPanel;
