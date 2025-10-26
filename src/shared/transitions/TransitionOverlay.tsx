import { memo } from "react"

import { cn } from "@/shared/utils/class-names"

import { usePageTransition } from "./PageTransitionProvider"
import "./transition-overlay.css"

export const TransitionOverlay = memo(function TransitionOverlay() {
  const { isActive, phase, message, reducedMotion } = usePageTransition()

  const overlayClassName = cn(
    "transition-overlay",
    isActive && "transition-overlay--visible",
    !reducedMotion && phase === "exiting" && "transition-overlay--exiting",
    !reducedMotion && phase === "entering" && "transition-overlay--entering",
    reducedMotion && "transition-overlay--reduced",
  )

  return (
    <div
      className={overlayClassName}
      role="status"
      aria-live="polite"
      aria-hidden={!isActive}
      data-phase={phase}
    >
      <div className="transition-overlay__content">
        <div className="transition-overlay__spinner" aria-hidden="true" />
        {message ? <p className="transition-overlay__message">{message}</p> : null}
      </div>
    </div>
  )
})
