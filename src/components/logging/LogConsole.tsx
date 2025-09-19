import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivitySquare,
  Copy,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  LOG_LEVEL_ORDER,
  type AppLogEntry,
  type LogLevel,
  useLogs,
} from "@/logging/LogProvider";
import { logger } from "@/logging";

const LEVEL_STYLES: Record<LogLevel, string> = {
  TRACE: "bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  DEBUG: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  INFO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  WARN: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  ERROR: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200",
};

export function LogConsole() {
  const {
    entries,
    isStreaming,
    setStreaming,
    clear,
    droppedWhilePaused,
    maxEntries,
  } = useLogs();
  const [activeLevels, setActiveLevels] = useState<LogLevel[]>(LOG_LEVEL_ORDER);
  const [includeFrontend, setIncludeFrontend] = useState(true);
  const [includeBackend, setIncludeBackend] = useState(true);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const queryToken = query.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (activeLevels.length && !activeLevels.includes(entry.level)) {
        return false;
      }

      if (entry.source === "frontend" && !includeFrontend) return false;
      if (entry.source === "backend" && !includeBackend) return false;

      if (!queryToken) return true;

      return matchesQuery(entry, queryToken);
    });
  }, [entries, activeLevels, includeFrontend, includeBackend, queryToken]);

  useEffect(() => {
    if (!isStreaming) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [filteredEntries, isStreaming]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    [],
  );

  const handleToggleLevel = (level: LogLevel) => {
    setActiveLevels((prev) =>
      prev.includes(level) ? prev.filter((value) => value !== level) : [...prev, level],
    );
  };

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      void logger.warn("Clipboard API is not available; skipping log export");
      return;
    }

    const exportPayload = filteredEntries.map(formatLogForExport).join("\n");

    try {
      await navigator.clipboard.writeText(exportPayload || "<no logs>");
      void logger.info("Copied logs to clipboard", {
        copied_count: filteredEntries.length,
      });
    } catch (error) {
      void logger.error("Failed to copy logs to clipboard", error);
    }
  };

  const handleClear = () => {
    clear();
    setQuery("");
  };

  return (
    <Card className="h-full">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border/60 bg-primary/10 p-2 text-primary">
              <ActivitySquare className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Live Logs</CardTitle>
              <CardDescription>
                Streaming {entries.length} / {maxEntries} log entries
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setStreaming(!isStreaming)}
            >
              {isStreaming ? (
                <>
                  <PauseCircle className="size-4" aria-hidden="true" />
                  Pause
                </>
              ) : (
                <>
                  <PlayCircle className="size-4" aria-hidden="true" />
                  Resume
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={handleClear}>
              <Trash2 className="size-4" aria-hidden="true" />
              Clear
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => void handleCopy()}
            >
              <Copy className="size-4" aria-hidden="true" />
              Copy
            </Button>
          </div>
        </div>

        {droppedWhilePaused > 0 ? (
          <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
            Streaming is paused. {droppedWhilePaused} log entries were skipped.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {LOG_LEVEL_ORDER.map((level) => {
            const isActive = activeLevels.includes(level);
            return (
              <Button
                key={level}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleToggleLevel(level)}
                className="uppercase"
              >
                {level}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={includeFrontend ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIncludeFrontend((prev) => !prev)}
          >
            Frontend
          </Button>
          <Button
            type="button"
            variant={includeBackend ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIncludeBackend((prev) => !prev)}
          >
            Backend
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter logs by message, target, or metadata"
              className="pr-24"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1 text-xs uppercase text-muted-foreground">
              <Separator orientation="vertical" className="h-5" />
              <span>Search</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <Separator className="mb-2" />
        <div
          ref={containerRef}
          className="max-h-72 overflow-auto px-6"
          data-testid="log-console-list"
        >
          {filteredEntries.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No log entries match the filters.</p>
          ) : (
            <ul className="space-y-3">
              {filteredEntries.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border/50 bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{timeFormatter.format(new Date(entry.timestamp))}</span>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 font-medium ${LEVEL_STYLES[entry.level]}`}>
                        {entry.level}
                      </span>
                      <span className="rounded-md bg-background/80 px-2 py-0.5 font-mono uppercase tracking-wide">
                        {entry.source}
                      </span>
                      {entry.target ? (
                        <span className="font-mono text-[11px] text-muted-foreground/80">
                          {entry.target}
                        </span>
                      ) : null}
                      {entry.modulePath ? (
                        <span className="font-mono text-[11px] text-muted-foreground/60">
                          {entry.modulePath}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{entry.message}</p>
                  {entry.file ? (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                      {entry.file}
                      {typeof entry.line === "number" ? `:${entry.line}` : ""}
                    </p>
                  ) : null}
                  {entry.keyValues ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
                      {Object.entries(entry.keyValues).map(([key, value]) => (
                        <span
                          key={`${entry.id}-${key}`}
                          className="rounded-md border border-border/60 bg-background/80 px-2 py-0.5"
                          >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function matchesQuery(entry: AppLogEntry, query: string) {
  const message = entry.message.toLowerCase();
  if (message.includes(query)) return true;

  if (entry.target && entry.target.toLowerCase().includes(query)) {
    return true;
  }

  if (entry.modulePath && entry.modulePath.toLowerCase().includes(query)) {
    return true;
  }

  if (entry.file && entry.file.toLowerCase().includes(query)) {
    return true;
  }

  if (entry.keyValues) {
    for (const [key, value] of Object.entries(entry.keyValues)) {
      if (key.toLowerCase().includes(query) || value.toLowerCase().includes(query)) {
        return true;
      }
    }
  }

  return false;
}

function formatLogForExport(entry: AppLogEntry) {
  const metadata = entry.keyValues
    ? ` ${Object.entries(entry.keyValues)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")}`
    : "";

  const modulePart = entry.modulePath ? ` ${entry.modulePath}` : "";

  return `${new Date(entry.timestamp).toISOString()} [${entry.level}] (${entry.source}) ${entry.target ?? ""}${modulePart} ${entry.message}${metadata}`.trim();
}
