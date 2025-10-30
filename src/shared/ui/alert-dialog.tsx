import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ComponentProps, HTMLAttributes } from "react";

import { cn } from "@/shared/utils/class-names";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

type AlertDialogOverlayProps = ComponentProps<typeof AlertDialogPrimitive.Overlay>;
function AlertDialogOverlay({ className, ref: forwardedRef, ...props }: AlertDialogOverlayProps) {
  return (
    <AlertDialogPrimitive.Overlay
      {...props}
      ref={forwardedRef}
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
        className,
      )}
    />
  );
}
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

type AlertDialogContentProps = ComponentProps<typeof AlertDialogPrimitive.Content>;
function AlertDialogContent({
  className,
  children,
  ref: forwardedRef,
  ...props
}: AlertDialogContentProps) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        {...props}
        ref={forwardedRef}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/80 bg-background p-6 shadow-xl duration-200 sm:rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out",
          className,
        )}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
}
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />;
}
AlertDialogHeader.displayName = "AlertDialogHeader";

function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
AlertDialogFooter.displayName = "AlertDialogFooter";

type AlertDialogTitleProps = ComponentProps<typeof AlertDialogPrimitive.Title>;
function AlertDialogTitle({ className, ref: forwardedRef, ...props }: AlertDialogTitleProps) {
  return (
    <AlertDialogPrimitive.Title
      {...props}
      ref={forwardedRef}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    />
  );
}
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

type AlertDialogDescriptionProps = ComponentProps<typeof AlertDialogPrimitive.Description>;
function AlertDialogDescription({ className, ref: forwardedRef, ...props }: AlertDialogDescriptionProps) {
  return (
    <AlertDialogPrimitive.Description
      {...props}
      ref={forwardedRef}
      className={cn("text-sm text-muted-foreground", className)}
    />
  );
}
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = AlertDialogPrimitive.Action;
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = AlertDialogPrimitive.Cancel;
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
