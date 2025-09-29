import { ReactNode } from "react";
import { Upload, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileDrop, type UseFileDropOptions } from "@/hooks/useFileDrop";
import { PROJECT_FILE_FORMAT_ACCESSIBILITY_TEXT, PROJECT_FILE_FORMAT_GROUPS } from "@/lib/file-formats";
import { Button } from "./button";

interface DropZoneProps extends UseFileDropOptions {
  onBrowseClick?: () => void | Promise<void>;
  className?: string;
  children?: ReactNode;
  variant?: "default" | "compact" | "empty-state";
  showBrowseButton?: boolean;
  title?: string;
  description?: ReactNode;
}

export function DropZone({
  onBrowseClick,
  className,
  children,
  variant = "default",
  showBrowseButton = true,
  title,
  description,
  disabled = false,
  isDragActive: externalDragActive,
  isDragOver: externalDragOver,
}: DropZoneProps) {
  const { isDragOver, isDragActive, getRootProps } = useFileDrop({
    disabled,
    isDragActive: externalDragActive,
    isDragOver: externalDragOver,
  });

  const getVariantStyles = () => {
    switch (variant) {
      case "compact":
        return "p-2 min-h-[60px]";
      case "empty-state":
        return "p-12 min-h-[240px]";
      default:
        return "p-6 min-h-[160px]";
    }
  };

  const getContent = () => {
    if (children) {
      return children;
    }

    const iconSize = variant === "empty-state" ? "h-12 w-12" : variant === "compact" ? "h-4 w-4" : "h-8 w-8";
    const titleSize = variant === "empty-state" ? "text-lg" : variant === "compact" ? "text-sm" : "text-base";
    const descriptionMaxWidth = variant === "empty-state" ? "max-w-2xl" : "max-w-xl";
    const descriptionTextSize = variant === "empty-state" ? "text-sm" : "text-xs";

    const defaultDescription = (
      <div
        className={cn(
          "mx-auto flex flex-col items-center text-center text-muted-foreground",
          descriptionMaxWidth,
          variant === "compact" ? "gap-1.5" : "gap-2",
        )}
      >
        <p className={cn("leading-snug", descriptionTextSize)}>
          Drop translation files or click Browse. Supported formats:
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 text-[11px] leading-tight">
          {PROJECT_FILE_FORMAT_GROUPS.map((group) => (
            <span
              key={group.label}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1"
            >
              <span className="font-medium text-foreground">{group.label}:</span>
              <span className="text-muted-foreground">{group.extensions.join(", ")}</span>
            </span>
          ))}
        </div>
      </div>
    );

    const descriptionContent = (() => {
      if (description === null || description === false) {
        return null;
      }

      if (description === undefined) {
        return defaultDescription;
      }

      if (typeof description === "string") {
        return (
          <p
            className={cn(
              "mx-auto text-center text-muted-foreground leading-snug",
              descriptionTextSize,
              descriptionMaxWidth,
            )}
          >
            {description}
          </p>
        );
      }

      return description;
    })();

    const contentSpacing = variant === "compact" ? "space-y-2" : "space-y-3";

    return (
      <div className={cn("flex flex-col items-center justify-center text-center", contentSpacing)}>
        <div className={cn(
          "flex items-center justify-center rounded-full",
          variant === "empty-state"
            ? "h-20 w-20 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
            : variant === "compact"
            ? "h-10 w-10 bg-muted/60 border border-border/60"
            : "h-12 w-12 bg-muted/60 border border-border/60"
        )}>
          {isDragActive ? (
            <Plus className={cn(iconSize, "text-primary")} />
          ) : (
            <Upload className={cn(iconSize, variant === "empty-state" ? "text-primary/60" : "text-muted-foreground")} />
          )}
        </div>

        <div className={cn(variant === "compact" ? "space-y-1" : "space-y-2")}>
          <h3 className={cn("font-semibold text-foreground", titleSize)}>
            {title || (isDragActive ? "Drop files here" : "Add more files")}
          </h3>
          {descriptionContent}
        </div>

        {showBrowseButton && onBrowseClick && (
          <Button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await onBrowseClick();
              } catch {
                // handled upstream; drop zone stays presentational
              }
            }}
            size={variant === "compact" ? "sm" : "default"}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Browse Files
          </Button>
        )}

      </div>
    );
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
        "hover:border-primary/40 hover:bg-primary/5",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        isDragActive && "border-primary bg-primary/10 shadow-lg scale-[1.02]",
        isDragOver && "border-primary/60 bg-primary/5",
        !isDragActive && !isDragOver && "border-border/60 bg-background/50 backdrop-blur-sm",
        getVariantStyles(),
        className
      )}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label={
        disabled
          ? "File drop zone (disabled)"
          : `Add files by dropping them here or clicking to browse. ${
              typeof description === "string" && description.trim().length > 0
                ? description
                : PROJECT_FILE_FORMAT_ACCESSIBILITY_TEXT
            }`
      }
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onBrowseClick && !disabled) {
          e.preventDefault();
          void (async () => {
            try {
              await onBrowseClick();
            } catch {
              // handled upstream
            }
          })();
        }
      }}
    >
      {/* Animated background overlay for drag states */}
      <div className={cn(
        "absolute inset-0 rounded-xl transition-opacity duration-200",
        isDragActive ? "opacity-100" : "opacity-0",
        "bg-gradient-to-br from-primary/5 to-primary/10",
        "animate-pulse"
      )} />

      {/* Content */}
      <div className="relative z-10">
        {getContent()}
      </div>

      {/* Drag overlay with enhanced visual feedback */}
      {isDragActive && (
        <div className="absolute inset-0 rounded-xl border-2 border-primary bg-primary/10 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
                <Plus className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-sm font-medium text-primary">
              Release to add files
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
