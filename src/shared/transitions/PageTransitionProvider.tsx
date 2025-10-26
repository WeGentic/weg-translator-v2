import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"
import { useRouter, useRouterState } from "@tanstack/react-router"

import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"

import { TransitionOverlay } from "./TransitionOverlay"

type TransitionPhase = "idle" | "exiting" | "entering"

interface SuspenseEntry {
  id: number
  message: string | null
}

export interface PageTransitionContextValue {
  phase: TransitionPhase
  message: string | null
  setMessage: (message: string | null) => void
  registerSuspense: (message?: string | null) => () => void
  isActive: boolean
  reducedMotion: boolean
}

const DEFAULT_MESSAGE = "Loading Weg Translator…"

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null)

let suspenseIdCounter = 0

export function PageTransitionProvider({ children }: PropsWithChildren): JSX.Element {
  const router = useRouter()
  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<TransitionPhase>("idle")
  const [message, setMessageState] = useState<string | null>(null)
  const [suspenseEntries, setSuspenseEntries] = useState<SuspenseEntry[]>([])
  const exitTimerRef = useRef<number>()
  const messageRef = useRef<string | null>(null)

  const { isLoading, hasPendingMatches } = useRouterState({
    select: (state) => ({
      isLoading: state.isLoading,
      hasPendingMatches: state.matches.some((match) => match.status === "pending"),
    }),
    structuralSharing: true,
  })

  const isRouterPending = isLoading || hasPendingMatches
  const suspenseDepth = suspenseEntries.length
  const activeSuspenseEntry = suspenseEntries.at(-1)
  const suspenseMessage =
    activeSuspenseEntry?.message && activeSuspenseEntry.message.trim().length > 0
      ? activeSuspenseEntry.message
      : null

  const setMessage = useCallback((next: string | null) => {
    messageRef.current = next
    setMessageState(next)
  }, [])

  const registerSuspense = useCallback((entryMessage?: string | null) => {
    const id = suspenseIdCounter++
    const sanitizedMessage = entryMessage ?? null

    setSuspenseEntries((entries) => [...entries, { id, message: sanitizedMessage }])

    return () => {
      setSuspenseEntries((entries) => entries.filter((entry) => entry.id !== id))
    }
  }, [])

  useEffect(() => {
    messageRef.current = message
  }, [message])

  useEffect(() => {
    let disposed = false

    const clearExitTimer = () => {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = undefined
      }
    }

    const handleResolved = () => {
      if (disposed) return

      if (reducedMotion) {
        setPhase("idle")
        return
      }

      setPhase("entering")
      clearExitTimer()
      exitTimerRef.current = window.setTimeout(() => {
        setPhase("idle")
      }, 240)
    }

    const unsubscribers = [
      router.subscribe("onBeforeNavigate", () => {
        if (disposed || reducedMotion) return
        clearExitTimer()
        setPhase("exiting")
      }),
      router.subscribe("onResolved", handleResolved),
    ]

    if (reducedMotion) {
      setPhase("idle")
    }

    return () => {
      disposed = true
      clearExitTimer()
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
    }
  }, [router, reducedMotion])

  const isActive =
    (!reducedMotion && phase !== "idle") || isRouterPending || suspenseDepth > 0

  const displayedMessage = isActive
    ? messageRef.current ?? suspenseMessage ?? DEFAULT_MESSAGE
    : null

  useEffect(() => {
    if (!isActive && messageRef.current) {
      setMessage(null)
    }
  }, [isActive, setMessage])

  const contextValue = useMemo<PageTransitionContextValue>(
    () => ({
      phase: reducedMotion ? "idle" : phase,
      message: displayedMessage,
      setMessage,
      registerSuspense,
      isActive,
      reducedMotion,
    }),
    [displayedMessage, isActive, phase, reducedMotion, registerSuspense, setMessage],
  )

  return (
    <PageTransitionContext.Provider value={contextValue}>
      {children}
      <TransitionOverlay />
    </PageTransitionContext.Provider>
  )
}

export function usePageTransition(): PageTransitionContextValue {
  const context = useContext(PageTransitionContext)
  if (!context) {
    throw new Error("usePageTransition must be used within a PageTransitionProvider")
  }
  return context
}
