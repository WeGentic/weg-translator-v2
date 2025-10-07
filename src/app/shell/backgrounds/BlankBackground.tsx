import type { ComponentPropsWithRef, CSSProperties } from "react";

import { cn } from "@/shared/utils/class-names";

import "@/shared/styles/layout/backgrounds/blank-background.css";

const TONE_CLASSES = {
  default: "blank-background--tone-default",
  muted: "blank-background--tone-muted",
  subtle: "blank-background--tone-subtle",
  inverted: "blank-background--tone-inverted",
  transparent: "blank-background--tone-transparent",
} as const;

type Tone = keyof typeof TONE_CLASSES;

type DivPropsWithRef = ComponentPropsWithRef<"div">;

export type BlankBackgroundProps = {
  tone?: Tone;
  style?: CSSProperties;
} & Omit<DivPropsWithRef, "style">;

/**
 * Minimal surface background that keeps layout regions blank by default while
 * still allowing routes to opt-in to specific tones or custom utility classes.
 */
export function BlankBackground({ tone = "default", className, children, style, ref, ...props }: BlankBackgroundProps) {
  const toneClass = TONE_CLASSES[tone] ?? TONE_CLASSES.default;

  return (
    <div ref={ref} className={cn("blank-background", toneClass, className)} style={style} {...props}>
      {children}
    </div>
  );
}
