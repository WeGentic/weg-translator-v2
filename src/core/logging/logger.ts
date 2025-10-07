import {
  debug as tauriDebug,
  error as tauriError,
  info as tauriInfo,
  warn as tauriWarn,
  type LogOptions,
} from "@tauri-apps/plugin-log";

type Primitive = string | number | boolean | null | undefined;

export type LogContext = Record<string, Primitive | Record<string, unknown>>;

async function dispatch(
  fn: (message: string, options?: LogOptions) => Promise<void>,
  message: string,
  context?: LogContext,
  extras?: Record<string, string>,
) {
  try {
    const keyValues = mergeContext(context, extras);
    await fn(message, keyValues ? { keyValues } : undefined);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Logger dispatch failed", error, message, context);
    }
  }
}

export function logInfo(message: string, context?: LogContext) {
  return dispatch(tauriInfo, message, context);
}

export function logWarn(message: string, context?: LogContext) {
  return dispatch(tauriWarn, message, context);
}

export function logDebug(message: string, context?: LogContext) {
  return dispatch(tauriDebug, message, context);
}

export function logError(message: string, error?: unknown, context?: LogContext) {
  return dispatch(tauriError, message, context, extractErrorContext(error));
}

export const logger = {
  info: logInfo,
  warn: logWarn,
  debug: logDebug,
  error: logError,
};

function mergeContext(
  context?: LogContext,
  extras?: Record<string, string>,
): Record<string, string> | undefined {
  const entries: Array<[string, string]> = [["source", "frontend"]];

  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value == null) continue;

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        entries.push([key, String(value)]);
      } else {
        try {
          entries.push([key, JSON.stringify(value)]);
        } catch (error) {
          entries.push([key, "<unserializable>"]);
          if (import.meta.env.DEV) {
            console.warn("Failed to serialize log context", key, value, error);
          }
        }
      }
    }
  }

  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value) {
        entries.push([key, value]);
      }
    }
  }

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function extractErrorContext(error: unknown): Record<string, string> | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    const details: Record<string, string> = {
      error_name: error.name,
      error_message: error.message,
    };

    if (error.stack) {
      details.error_stack = truncate(error.stack, 2_000);
    }

    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      details.error_cause = truncate(`${cause.name}: ${cause.message}`, 512);
    } else if (typeof cause === "string") {
      details.error_cause = truncate(cause, 512);
    }

    return details;
  }

  if (typeof error === "string") {
    return { error_message: error };
  }

  try {
    return { error_message: JSON.stringify(error) };
  } catch {
    return { error_message: "<unserializable error>" };
  }
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…(+${value.length - maxLength})`;
}
