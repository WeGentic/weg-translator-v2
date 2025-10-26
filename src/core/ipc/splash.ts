import { invoke } from "@tauri-apps/api/core"

export type ShellReadyPayload = {
  timestamp: number
  authStatus: ShellReadyAuthStatus
}

export type ShellReadyAuthStatus = "loading" | "guest" | "authenticated"

export async function notifyShellReady(payload: ShellReadyPayload): Promise<void> {
  await invoke("notify_shell_ready", { payload })
}
