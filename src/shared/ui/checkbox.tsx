import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "@/shared/utils/class-names"

/**
 * Checkbox Component
 *
 * A custom checkbox component with rounded borders and theme-aware styling.
 * Uses CSS variables from App.css for consistent theming across the application.
 *
 * Features:
 * - Rounded corners (rounded-md) for modern appearance
 * - Border using --color-tr-ring from theme
 * - Smooth transitions for all interactive states
 * - Accessible focus states with ring indicators
 * - Supports checked, indeterminate, and disabled states
 *
 * @example
 * ```tsx
 * <Checkbox checked={true} onCheckedChange={(checked) => console.log(checked)} />
 * ```
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Base styles: rounded checkbox with fixed size
        "peer size-4 shrink-0 rounded-md",
        // Border using theme ring color for consistency
        "border-2 border-[var(--color-tr-ring)]",
        // Background and ring offset
        "ring-offset-background",
        // Smooth transitions for all state changes
        "transition-all duration-200 ease-in-out",
        // Focus state: visible outline with ring color
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-tr-ring)]/50 focus-visible:ring-offset-2",
        // Hover state: slight border color intensification
        "hover:border-[var(--color-tr-primary-blue)] hover:shadow-sm",
        // Disabled state: reduced opacity and no pointer events
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Checked state: primary background with contrast text
        "data-[state=checked]:bg-[var(--color-tr-primary-blue)] data-[state=checked]:border-[var(--color-tr-primary-blue)] data-[state=checked]:text-primary-foreground",
        // Indeterminate state styling
        "data-[state=indeterminate]:bg-[var(--color-tr-primary-blue)] data-[state=indeterminate]:border-[var(--color-tr-primary-blue)]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {/* Checkmark icon - renders when checked */}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5">
          <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

