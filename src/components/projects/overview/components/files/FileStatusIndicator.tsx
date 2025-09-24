import { useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import type { ProjectFileConversionDto } from "@/ipc";
import { cn } from "@/lib/utils";

interface Props {
  importStatus: string;
  conversions: ProjectFileConversionDto[];
  showProgress?: boolean;
}

export function FileStatusIndicator({ importStatus, conversions, showProgress = false }: Props) {
  const { icon, className, label } = useMemo(() => {
    // First check import status
    if (importStatus === "failed") {
      return {
        icon: <XCircle className="h-3 w-3" />,
        className: "border-destructive/40 bg-destructive/10 text-destructive",
        label: "Import Failed"
      };
    }

    if (importStatus !== "imported") {
      return {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        className: "border-primary/40 bg-primary/10 text-primary",
        label: "Importing..."
      };
    }

    // Check conversion statuses
    if (conversions.length === 0) {
      return {
        icon: <Clock className="h-3 w-3" />,
        className: "border-border/60 bg-muted text-muted-foreground",
        label: "No Conversions"
      };
    }

    const hasRunning = conversions.some(c => c.status === "running");
    const hasFailed = conversions.some(c => c.status === "failed");
    const hasCompleted = conversions.some(c => c.status === "completed");
    const allCompleted = conversions.every(c => c.status === "completed");

    if (hasRunning) {
      return {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        className: "border-primary/40 bg-primary/10 text-primary",
        label: "Converting..."
      };
    }

    if (hasFailed && !hasCompleted) {
      return {
        icon: <XCircle className="h-3 w-3" />,
        className: "border-destructive/40 bg-destructive/10 text-destructive",
        label: "Conversion Failed"
      };
    }

    if (hasFailed && hasCompleted) {
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        className: "border-amber-500/40 bg-amber-500/10 text-amber-600",
        label: "Partially Complete"
      };
    }

    if (allCompleted) {
      return {
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
        label: "Complete"
      };
    }

    return {
      icon: <Clock className="h-3 w-3" />,
      className: "border-border/60 bg-muted text-muted-foreground",
      label: "Pending"
    };
  }, [importStatus, conversions]);

  const progressInfo = useMemo(() => {
    if (conversions.length === 0) return null;

    const completed = conversions.filter(c => c.status === "completed").length;
    const failed = conversions.filter(c => c.status === "failed").length;
    const running = conversions.filter(c => c.status === "running").length;
    const total = conversions.length;

    return { completed, failed, running, total };
  }, [conversions]);

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          className
        )}
        title={label}
      >
        {icon}
        {label}
      </span>

      {showProgress && progressInfo && progressInfo.total > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            {progressInfo.completed}/{progressInfo.total}
          </span>
          {progressInfo.failed > 0 && (
            <span className="text-destructive">({progressInfo.failed} failed)</span>
          )}
        </div>
      )}
    </div>
  );
}

export default FileStatusIndicator;