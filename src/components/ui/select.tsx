import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger>;
function SelectTrigger({ className, children, ref: forwardedRef, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      {...props}
      ref={forwardedRef}
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

type SelectContentProps = ComponentProps<typeof SelectPrimitive.Content>;
function SelectContent({ className, children, position = "popper", ref: forwardedRef, ...props }: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        {...props}
        position={position}
        ref={forwardedRef}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out",
          position === "popper" &&
            "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          className,
        )}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 cursor-default items-center justify-center bg-popover text-muted-foreground">
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 cursor-default items-center justify-center bg-popover text-muted-foreground">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}
SelectContent.displayName = SelectPrimitive.Content.displayName;

type SelectLabelProps = ComponentProps<typeof SelectPrimitive.Label>;
function SelectLabel({ className, ref: forwardedRef, ...props }: SelectLabelProps) {
  return (
    <SelectPrimitive.Label
      {...props}
      ref={forwardedRef}
      className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
    />
  );
}
SelectLabel.displayName = SelectPrimitive.Label.displayName;

type SelectItemProps = ComponentProps<typeof SelectPrimitive.Item>;
function SelectItem({ className, children, ref: forwardedRef, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      {...props}
      ref={forwardedRef}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
SelectItem.displayName = SelectPrimitive.Item.displayName;

type SelectSeparatorProps = ComponentProps<typeof SelectPrimitive.Separator>;
function SelectSeparator({ className, ref: forwardedRef, ...props }: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator
      {...props}
      ref={forwardedRef}
      className={cn("-mx-1 my-1 h-px bg-border", className)}
    />
  );
}
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
