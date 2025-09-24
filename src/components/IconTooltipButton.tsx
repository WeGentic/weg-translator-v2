import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  }, [disabled, updatePosition]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  const toneClasses =
    tone === "destructive"
      ? "text-destructive hover:text-destructive focus-visible:text-destructive"
      : tone === "muted"
      ? "text-muted-foreground hover:text-foreground"
      : "";

  return (
    <>
      <Button
        ref={buttonRef}
        type={type}
        size="icon"
        variant="ghost"
        aria-label={ariaLabel}
        aria-describedby={isOpen ? tooltipId : undefined}
        disabled={disabled}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        className={cn(
          "h-8 w-8 rounded-full border border-transparent text-foreground transition hover:border-border/70",
          toneClasses,
          disabled ? "opacity-60" : null,
          className,
        )}
        {...props}
      >
        {children}
      </Button>
      {isOpen && !disabled
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-md border border-border/60 bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
              style={{ top: `${Math.max(position.top, 6)}px`, left: `${position.left}px` }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default IconTooltipButton;
