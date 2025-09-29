import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value ?? 0));

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-primary/10 shadow-[inset_0_1px_1px_rgb(15_23_42_/_0.08)] dark:bg-primary/15",
          "supports-[backdrop-filter]:bg-primary/15 supports-[backdrop-filter]:backdrop-blur-sm",
          className,
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        {...props}
      >
        <div
          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${clamped - 100}%)` }}
        />
      </div>
    );
  },
);

Progress.displayName = "Progress";
