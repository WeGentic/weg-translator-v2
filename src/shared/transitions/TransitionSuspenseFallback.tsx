import { useEffect } from "react"

import { usePageTransition } from "./PageTransitionProvider"

const DEFAULT_SUSPENSE_MESSAGE = "Loading next view…"

interface TransitionSuspenseFallbackProps {
  message?: string
}

export function TransitionSuspenseFallback({
  message = DEFAULT_SUSPENSE_MESSAGE,
}: TransitionSuspenseFallbackProps): null {
  const { registerSuspense } = usePageTransition()

  useEffect(() => {
    const unregister = registerSuspense(message)
    return unregister
  }, [message, registerSuspense])

  return null
}
