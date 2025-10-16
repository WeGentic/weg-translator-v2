import { invoke } from "@tauri-apps/api/core";

function hasCustomToString(value: { toString?: unknown }): value is { toString: () => string } {
  return typeof value.toString === "function" && value.toString !== Object.prototype.toString;
}

export function normalizeIpcError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  if (err && typeof err === "object") {
    const candidate = err as { message?: unknown; toString?: unknown };

    if (typeof candidate.message === "string") {
      return candidate.message;
    }

    if (hasCustomToString(candidate)) {
      try {
        return candidate.toString();
      } catch {
        // fall through to JSON serialization
      }
    }

    try {
      return JSON.stringify(candidate);
    } catch {
      // ignore JSON serialization errors
    }
  }

  return "Unknown error calling backend";
}

export async function safeInvoke<T>(command: string, payload?: Record<string, unknown>) {
  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    const message = normalizeIpcError(error);
    throw new Error(`[IPC] ${command} failed: ${message}`);
  }
}
