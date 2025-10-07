import type { ComponentPropsWithRef, CSSProperties } from "react";

import { cn } from "@/shared/utils/class-names";

import "@/shared/styles/layout/backgrounds/modern-grid-background.css";

const GRADIENT_VARIANTS = {
  mesh: "modern-grid-background--variant-mesh",
  aurora: "modern-grid-background--variant-aurora",
  jewel: "modern-grid-background--variant-jewel",
  monochrome: "modern-grid-background--variant-monochrome",
  sunset: "modern-grid-background--variant-sunset",
  ocean: "modern-grid-background--variant-ocean",
} as const;

const GRID_PATTERNS = {
  dots: {
    backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
  },
  lines: {
    backgroundImage: `
      linear-gradient(to right, currentColor 1px, transparent 1px),
      linear-gradient(to bottom, currentColor 1px, transparent 1px)
    `,
  },
  mixed: {
    backgroundImage: `
      radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0),
      linear-gradient(to right, currentColor 0.5px, transparent 0.5px),
      linear-gradient(to bottom, currentColor 0.5px, transparent 0.5px)
    `,
  },
  perspective: {
    backgroundImage: `
      linear-gradient(90deg, transparent 0%, currentColor 50%, transparent 100%),
      linear-gradient(0deg, transparent 0%, currentColor 50%, transparent 100%)
    `,
    transform: "perspective(1000px) rotateX(2deg)",
  },
} as const;

type GradientVariant = keyof typeof GRADIENT_VARIANTS;
type GridType = keyof typeof GRID_PATTERNS;
type DivPropsWithRef = ComponentPropsWithRef<"div">;

export type ModernGridBackgroundProps = {
  variant?: GradientVariant;
  gridType?: GridType;
  gridSize?: number;
  gridOpacity?: number;
  fadeEdges?: boolean;
  style?: CSSProperties;
} & Omit<DivPropsWithRef, "style">;

/**
 * Ultra-modern static gradient background with subtle grid structure.
 * Designed for professional applications with excellent readability and aesthetic appeal.
 */
export function ModernGridBackground({
  variant = "mesh",
  gridType = "dots",
  gridSize = 20,
  gridOpacity = 0.15,
  fadeEdges = true,
  className,
  children,
  style,
  ref,
  ...props
}: ModernGridBackgroundProps) {
  const gradientClass = GRADIENT_VARIANTS[variant];
  const gridPattern = GRID_PATTERNS[gridType];

  const gridStyles: CSSProperties = {
    backgroundSize: `${gridSize}px ${gridSize}px`,
    color: `rgb(0 0 0 / ${gridOpacity})`, // Light mode: subtle dark lines
    ...gridPattern,
    ...style,
  };

  // Dark mode override
  const darkModeGridStyles: CSSProperties = {
    ...gridStyles,
    color: `rgb(255 255 255 / ${gridOpacity * 0.8})`, // Dark mode: subtle white lines
  };

  // Apply fade mask if enabled
  if (fadeEdges) {
    gridStyles.maskImage = "radial-gradient(ellipse 70% 70% at 50% 50%, #000 60%, transparent 100%)";
    gridStyles.WebkitMaskImage = "radial-gradient(ellipse 70% 70% at 50% 50%, #000 60%, transparent 100%)";
  }

  return (
    <div
      ref={ref}
      className={cn(
        "modern-grid-background",
        gradientClass,
        className
      )}
      {...props}
    >
      {/* Grid overlay - Light Mode */}
      <div
        className="modern-grid-background__overlay-light"
        style={gridStyles}
      />

      {/* Grid overlay - Dark Mode */}
      <div
        className="modern-grid-background__overlay-dark"
        style={darkModeGridStyles}
      />

      {/* Subtle depth enhancement for mesh variant */}
      {variant === "mesh" && (
        <div
          className="modern-grid-background__layer-mesh"
          style={{
            background: `
              radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 60% 20%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)
            `,
          }}
        />
      )}

      {/* Aurora enhancement */}
      {variant === "aurora" && (
        <div
          className="modern-grid-background__layer-aurora"
          style={{
            background: `
              radial-gradient(ellipse at 30% 30%, rgba(59, 130, 246, 0.15) 0%, transparent 60%),
              radial-gradient(ellipse at 70% 70%, rgba(147, 51, 234, 0.15) 0%, transparent 60%)
            `,
          }}
        />
      )}

      {/* Jewel enhancement */}
      {variant === "jewel" && (
        <div
          className="modern-grid-background__layer-jewel"
          style={{
            background: `
              radial-gradient(circle at 40% 40%, rgba(16, 185, 129, 0.12) 0%, transparent 50%),
              radial-gradient(circle at 60% 60%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)
            `,
          }}
        />
      )}

      {/* Content layer */}
      {children && (
        <div className="modern-grid-background__content">
          {children}
        </div>
      )}
    </div>
  );
}
