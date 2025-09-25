import type { ComponentPropsWithRef, CSSProperties } from "react";

import { cn } from "@/lib/utils";

import "../css-styles/backgrounds/gradient-background.css";

const GRADIENT_VARIANTS = {
  mesh: "gradient-background--variant-mesh",
  aurora: "gradient-background--variant-aurora",
  holographic: "gradient-background--variant-holographic",
  glass: "gradient-background--variant-glass",
  waves: "gradient-background--variant-waves",
  orbs: "gradient-background--variant-orbs",
} as const;

const INTENSITY_MULTIPLIERS = {
  subtle: "gradient-background--intensity-subtle",
  medium: "gradient-background--intensity-medium",
  strong: "gradient-background--intensity-strong",
} as const;

type GradientVariant = keyof typeof GRADIENT_VARIANTS;
type GradientIntensity = keyof typeof INTENSITY_MULTIPLIERS;
type DivPropsWithRef = ComponentPropsWithRef<"div">;

export type GradientBackgroundProps = {
  variant?: GradientVariant;
  intensity?: GradientIntensity;
  animated?: boolean;
  withNoise?: boolean;
  noiseOpacity?: number;
  style?: CSSProperties;
} & Omit<DivPropsWithRef, "style">;

/**
 * Modern gradient background component with multiple visual styles.
 * Uses Tailwind CSS gradients for maximum browser compatibility.
 */
export function GradientBackground({
  variant = "aurora",
  intensity = "medium",
  animated = false,
  withNoise = false,
  noiseOpacity = 0.1,
  className,
  children,
  style,
  ref,
  ...props
}: GradientBackgroundProps) {
  const gradientClass = GRADIENT_VARIANTS[variant];
  const intensityClass = INTENSITY_MULTIPLIERS[intensity];
  const overlayVariantClass =
    variant === "aurora"
      ? "gradient-background__overlay-aurora"
      : variant === "mesh"
        ? "gradient-background__overlay-mesh"
        : variant === "holographic"
          ? "gradient-background__overlay-holographic"
          : "gradient-background__overlay-default";

  return (
    <div
      ref={ref}
      className={cn(
        "gradient-background",
        gradientClass,
        intensityClass,
        animated && "gradient-background--animated",
        className
      )}
      style={style}
      {...props}
    >
      {/* Animated overlay for more dynamic effect */}
      {animated && (
        <div
          className={cn("gradient-background__animated-overlay", overlayVariantClass)}
        />
      )}

      {/* Noise texture overlay */}
      {withNoise && (
        <svg
          className="gradient-background__noise"
          style={{ opacity: noiseOpacity }}
        >
          <defs>
            <filter id={`noise-${variant}`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="4"
                stitchTiles="stitch"
              />
              <feComponentTransfer>
                <feFuncA type="discrete" tableValues="0.5" />
              </feComponentTransfer>
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#noise-${variant})`} />
        </svg>
      )}

      {/* Content layer */}
      {children && (
        <div className="gradient-background__content">
          {children}
        </div>
      )}
    </div>
  );
}
