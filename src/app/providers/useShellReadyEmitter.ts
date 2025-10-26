import { useEffect, useRef } from "react"

import { logger } from "@/core/logging"
import { notifyShellReady, type ShellReadyAuthStatus } from "@/core/ipc/splash"

const PLACEHOLDER_ID = "app-placeholder"
const RETRY_DELAY_MS = 1_200

export function useShellReadyEmitter(status: ShellReadyAuthStatus) {
  const hasSignalledRef = useRef(false)
  const retryTimerRef = useRef<number>()
  const latestStatusRef = useRef(status)

  useEffect(() => {
    latestStatusRef.current = status
  }, [status])

  useEffect(() => {
    let disposed = false

    const clearPlaceholder = () => {
      const placeholder = document.getElementById(PLACEHOLDER_ID)
      if (!placeholder) {
        return
      }

      placeholder.setAttribute("aria-busy", "false")
      placeholder.setAttribute("data-shell-ready", "true")
      window.setTimeout(() => {
        if (placeholder.isConnected) {
          placeholder.remove()
        }
      }, 320)
    }

    const emitSignal = () => {
      const payload = {
        timestamp: performance.now(),
        authStatus: latestStatusRef.current,
      }

      notifyShellReady(payload)
        .then(() => {
          if (disposed) return
          hasSignalledRef.current = true
          clearPlaceholder()
        })
        .catch((error) => {
          if (disposed) return

          void logger.error(
            "Failed to notify splash controller about shell readiness",
            error,
            {
              event: "shell_ready_emit_failure",
              auth_status: latestStatusRef.current,
            },
          )

          retryTimerRef.current = window.setTimeout(emitSignal, RETRY_DELAY_MS)
        })
    }

    if (!hasSignalledRef.current) {
      emitSignal()
    }

    return () => {
      disposed = true

      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current)
      }
    }
  }, [])
}
