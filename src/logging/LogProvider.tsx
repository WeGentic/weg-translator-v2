import {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import {
  attachConsole,
  attachLogger,
  LogLevel as PluginLogLevel,
} from "@tauri-apps/plugin-log";

const MAX_LOG_ENTRIES = 500;

const KNOWN_LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const;

export type LogLevel = (typeof KNOWN_LEVELS)[number];

export type LogSource = "backend" | "frontend";

export interface AppLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  source: LogSource;
  target?: string;
  modulePath?: string;
  file?: string;
  line?: number;
  keyValues?: Record<string, string>;
}

interface LogState {
  entries: AppLogEntry[];
  isStreaming: boolean;
  droppedWhilePaused: number;
}

type LogAction =
  | { type: "append"; entry: AppLogEntry }
  | { type: "clear" }
  | { type: "setStreaming"; value: boolean };

export interface LogContextValue {
  entries: AppLogEntry[];
  isStreaming: boolean;
  droppedWhilePaused: number;
  clear: () => void;
  setStreaming: (value: boolean) => void;
  maxEntries: number;
}

const LogContext = createContext<LogContextValue | null>(null);

const initialState: LogState = {
  entries: [],
  isStreaming: true,
  droppedWhilePaused: 0,
};

export function LogProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(logReducer, initialState);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function bootstrap() {
      try {
        await attachConsole();
      } catch (error) {
        if (import.meta.env.DEV) {
          const safeError = toError(error);
          console.warn("attachConsole failed; continuing without console bridging", safeError);
        }
      }

      try {
        const unlisten = await attachLogger((record) => {
          if (cancelled) return;
          dispatch({ type: "append", entry: normalizeEntry(record) });
        });

        if (cancelled) {
          unlisten();
        } else {
          unsubscribe = unlisten;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          const safeError = toError(error);
          console.error("attachLogger failed; logs will not stream to UI", safeError);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<LogContextValue>(
    () => ({
      entries: state.entries,
      isStreaming: state.isStreaming,
      droppedWhilePaused: state.droppedWhilePaused,
      setStreaming: (value) => dispatch({ type: "setStreaming", value }),
      clear: () => dispatch({ type: "clear" }),
      maxEntries: MAX_LOG_ENTRIES,
    }),
    [state.entries, state.isStreaming, state.droppedWhilePaused],
  );

  return <LogContext value={value}>{children}</LogContext>;
}

export function useLogs() {
  const context = use(LogContext);
  if (!context) {
    throw new Error("useLogs must be used inside a LogProvider");
  }
  return context;
}

function logReducer(state: LogState, action: LogAction): LogState {
  switch (action.type) {
    case "append": {
      if (!state.isStreaming) {
        return {
          ...state,
          droppedWhilePaused: state.droppedWhilePaused + 1,
        };
      }

      const nextEntries = [...state.entries, action.entry];
      if (nextEntries.length > MAX_LOG_ENTRIES) {
        nextEntries.splice(0, nextEntries.length - MAX_LOG_ENTRIES);
      }
      return {
        ...state,
        entries: nextEntries,
      };
    }
    case "clear":
      return {
        ...state,
        entries: [],
        droppedWhilePaused: 0,
      };
    case "setStreaming":
      return {
        ...state,
        isStreaming: action.value,
        droppedWhilePaused: action.value ? 0 : state.droppedWhilePaused,
      };
    default:
      return state;
  }
}

let idCounter = 0;

function createEntryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      if (import.meta.env.DEV) {
        const safeError = toError(error);
        console.warn("randomUUID failed, falling back to counter", safeError);
      }
    }
  }
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `log-${Date.now()}-${idCounter}`;
}

interface LoggerRecord {
  level: PluginLogLevel;
  message: string;
}

interface StructuredPayload {
  timestamp?: string | number;
  level?: string;
  target?: string;
  modulePath?: string;
  file?: string;
  line?: number;
  message?: string;
  keyValues?: Record<string, unknown> | null;
}

function normalizeEntry(record: LoggerRecord): AppLogEntry {
  const structured = parseStructuredMessage(record.message);
  const message = structured?.message ?? record.message;
  const level = structured?.level ? ensureLevel(structured.level) : mapPluginLevel(record.level);
  const keyValues = normalizeKeyValues(structured?.keyValues ?? undefined);
  const timestamp = parseTimestamp(structured?.timestamp) ?? Date.now();
  const target = typeof structured?.target === "string" ? structured.target : undefined;
  const file = typeof structured?.file === "string" ? structured.file : undefined;
  const line = typeof structured?.line === "number" ? structured.line : undefined;
  const modulePath = typeof structured?.modulePath === "string" ? structured.modulePath : undefined;

  return {
    id: createEntryId(),
    level,
    message,
    timestamp,
    source: determineSource({ keyValues, target, file, modulePath }),
    target,
    modulePath,
    file,
    line,
    keyValues,
  };
}

function parseStructuredMessage(raw: string): StructuredPayload | null {
  if (!raw.trim().startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      return parsed as StructuredPayload;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      const safeError = toError(error);
      console.warn("Failed to parse structured log payload", safeError, raw);
    }
  }

  return null;
}

function mapPluginLevel(level: PluginLogLevel): LogLevel {
  switch (level) {
    case PluginLogLevel.Trace:
      return "TRACE";
    case PluginLogLevel.Debug:
      return "DEBUG";
    case PluginLogLevel.Warn:
      return "WARN";
    case PluginLogLevel.Error:
      return "ERROR";
    case PluginLogLevel.Info:
    default:
      return "INFO";
  }
}

function parseTimestamp(timestamp?: string | number) {
  if (typeof timestamp === "number") {
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  if (typeof timestamp === "string") {
    const numeric = Date.parse(timestamp);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return undefined;
}

function ensureLevel(level: string): LogLevel {
  const normalized = level.toUpperCase();
  if ((KNOWN_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as LogLevel;
  }

  if (normalized === "WARNING") {
    return "WARN";
  }

  return "INFO";
}

function normalizeKeyValues(record?: Record<string, unknown> | null) {
  if (!record) return undefined;
  const entries: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(record)) {
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      entries.push([key, String(value)]);
    } else {
      try {
        entries.push([key, JSON.stringify(value)]);
      } catch (error) {
        const safeError = toError(error);
        if (import.meta.env.DEV) {
          console.warn("Failed to serialize log key value", key, safeError);
        }
      }
    }
  }

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function determineSource(details: {
  keyValues?: Record<string, string>;
  target?: string;
  file?: string;
  modulePath?: string;
}): LogSource {
  const kvSource = details.keyValues?.source ?? details.keyValues?.SOURCE;
  if (typeof kvSource === "string") {
    return kvSource.toLowerCase() === "backend" ? "backend" : "frontend";
  }

  const target = details.target?.toLowerCase() ?? "";
  if (target.startsWith("webview")) {
    return "frontend";
  }

  if (target.includes("::") || details.modulePath?.includes("::")) {
    return "backend";
  }

  if (details.file?.endsWith(".rs")) {
    return "backend";
  }

  return "frontend";
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

export const LOG_LEVEL_ORDER: LogLevel[] = [...KNOWN_LEVELS];
