import { ReactNode } from "react";
import { Upload, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileDrop, type UseFileDropOptions } from "@/hooks/useFileDrop";
import { Button } from "./button";

interface DropZoneProps extends UseFileDropOptions {
  onBrowseClick?: () => void;
  className?: string;
  children?: ReactNode;
  variant?: "default" | "compact" | "empty-state";
  showBrowseButton?: boolean;
  title?: string;
  description?: string;
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
    const descSize = variant === "empty-state" ? "text-base" : variant === "compact" ? "text-xs" : "text-sm";

    return (
      <div className="flex flex-col items-center justify-center text-center space-y-3">
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

        <div className={cn("space-y-1", variant === "compact" && "space-y-0")}>
          <h3 className={cn("font-semibold text-foreground", titleSize)}>
            {title || (isDragActive ? "Drop files here" : "Add more files")}
          </h3>
          {variant !== "compact" && (
            <p className={cn("text-muted-foreground max-w-sm", descSize)}>
              {description || "Supported formats include XLIFF, TMX, DOCX, and more"}
            </p>
          )}
        </div>

        {showBrowseButton && onBrowseClick && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onBrowseClick();
            }}
            size={variant === "compact" ? "sm" : "default"}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Browse Files
          </Button>
        )}

        {variant === "empty-state" && showBrowseButton && onBrowseClick && (
          <div className="text-xs text-muted-foreground">
            Or use the file browser to select files
          </div>
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
          : "Add files by dropping them here or clicking to browse"
      }
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onBrowseClick && !disabled) {
          e.preventDefault();
          onBrowseClick();
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
