import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  default: "bg-background",
  muted: "bg-muted",
  subtle: "bg-muted/40",
  inverted: "bg-foreground text-background",
  transparent: "bg-transparent",
} as const;

type Tone = keyof typeof TONE_CLASSES;

export type BlankBackgroundProps = {
  tone?: Tone;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "style">;

/**
 * Minimal surface background that keeps layout regions blank by default while
 * still allowing routes to opt-in to specific tones or custom utility classes.
 */
export const BlankBackground = forwardRef<HTMLDivElement, BlankBackgroundProps>(
  ({ tone = "default", className, children, style, ...props }, ref) => {
    const toneClass = TONE_CLASSES[tone] ?? TONE_CLASSES.default;

    return (
      <div
        ref={ref}
        className={cn("h-full w-full", toneClass, className)}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  },
);

BlankBackground.displayName = "BlankBackground";
