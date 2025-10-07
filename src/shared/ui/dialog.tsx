import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";

import { cn } from "@/shared/utils/class-names";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

type DialogOverlayProps = ComponentProps<typeof DialogPrimitive.Overlay>;
function DialogOverlay({ className, ref: forwardedRef, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      {...props}
      ref={forwardedRef}
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
        className,
      )}
    />
  );
}
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content>;
function DialogContent({ className, children, ref: forwardedRef, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...props}
        ref={forwardedRef}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/80 bg-background p-6 shadow-xl duration-200 sm:rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out",
          className,
        )}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />;
}
DialogHeader.displayName = "DialogHeader";

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
DialogFooter.displayName = "DialogFooter";

type DialogTitleProps = ComponentProps<typeof DialogPrimitive.Title>;
function DialogTitle({ className, ref: forwardedRef, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      {...props}
      ref={forwardedRef}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    />
  );
}
DialogTitle.displayName = DialogPrimitive.Title.displayName;

type DialogDescriptionProps = ComponentProps<typeof DialogPrimitive.Description>;
function DialogDescription({ className, ref: forwardedRef, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      {...props}
      ref={forwardedRef}
      className={cn("text-sm text-muted-foreground", className)}
    />
  );
}
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogClose = DialogPrimitive.Close;
DialogClose.displayName = "DialogClose";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
