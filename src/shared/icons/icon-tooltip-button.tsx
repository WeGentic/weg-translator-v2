import { type ButtonHTMLAttributes, type ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/class-names";

type Tone = "default" | "destructive" | "muted";

type IconTooltipButtonProps = {
  label: string;
  ariaLabel: string;
  tone?: Tone;
  children: ReactNode;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "type" | "className">;

export function IconTooltipButton({
  label,
  ariaLabel,
  tone = "default",
  children,
  disabled,
  className,
  type = "button",
  ...props
}: IconTooltipButtonProps) {
  const toneClasses =
    tone === "destructive"
      ? "text-destructive hover:text-destructive focus-visible:text-destructive"
      : tone === "muted"
      ? "text-muted-foreground hover:text-foreground"
      : "";

  if (disabled) {
    return (
      <Button
        type={type}
        size="icon"
        variant="ghost"
        aria-label={ariaLabel}
        disabled
        className={cn(
          "h-7 w-7 rounded-full border border-transparent text-foreground opacity-60",
          toneClasses,
          className,
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type={type}
          size="icon"
          variant="ghost"
          aria-label={ariaLabel}
          className={cn(
            "h-7 w-7 rounded-full border border-transparent text-foreground transition hover:border-border/70 focus-visible:border-border/70",
            toneClasses,
            className,
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        <span className="text-[12px] leading-[1.3] font-semibold tracking-[0.02em]">
          {label}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export default IconTooltipButton;
