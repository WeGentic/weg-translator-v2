import { useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import type { ProjectFileConversionDto } from "@/core/ipc";
import { cn } from "@/shared/utils/class-names";

interface Props {
  importStatus: string;
  conversions: ProjectFileConversionDto[];
}

type Tone = "info" | "success" | "error" | "warning" | "neutral";

const BADGE_TONE_CLASS: Record<Tone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  info: "border-primary/40 bg-primary/10 text-primary",
  neutral: "border-border/60 bg-muted text-muted-foreground",
};

const DESCRIPTION_TONE_CLASS: Record<Tone, string> = {
  success: "text-xs text-emerald-600 dark:text-emerald-300",
  error: "text-xs text-destructive",
  warning: "text-xs text-amber-600 dark:text-amber-300",
  info: "text-xs text-muted-foreground",
  neutral: "text-xs text-muted-foreground",
};

export function FileStatusIndicator({ importStatus, conversions }: Props) {
  const status = useMemo(() => {
    const iconSize = "h-3.5 w-3.5";

    if (importStatus === "failed") {
      return {
        label: "Error",
        tone: "error" as const,
        icon: <XCircle className={iconSize} aria-hidden="true" />,
        description: "File import failed.",
      };
    }

    if (importStatus !== "imported") {
      return {
        label: "Importing…",
        tone: "info" as const,
        icon: <Loader2 className={cn(iconSize, "animate-spin")} aria-hidden="true" />,
        description: "Preparing file for conversion.",
      };
    }

    if (conversions.length === 0) {
      return {
        label: "Pending",
        tone: "neutral" as const,
        icon: <Clock className={iconSize} aria-hidden="true" />,
        description: "Waiting for conversion to start.",
      };
    }

    const failedConversion = conversions.find((conv) => conv.status === "failed");
    if (failedConversion) {
      const description = failedConversion.errorMessage?.trim()
        || `Conversion failed for ${failedConversion.srcLang} → ${failedConversion.tgtLang}.`;
      return {
        label: "Error",
        tone: "error" as const,
        icon: <XCircle className={iconSize} aria-hidden="true" />,
        description,
      };
    }

    const runningCount = conversions.filter((conv) => conv.status === "running").length;
    if (runningCount > 0) {
      return {
        label: "Processing…",
        tone: "info" as const,
        icon: <Loader2 className={cn(iconSize, "animate-spin")} aria-hidden="true" />,
        description: `${runningCount} conversion${runningCount === 1 ? "" : "s"} in progress.`,
      };
    }

    const pendingCount = conversions.filter((conv) => conv.status === "pending").length;
    if (pendingCount > 0) {
      return {
        label: "Queued",
        tone: "info" as const,
        icon: <Clock className={iconSize} aria-hidden="true" />,
        description: `${pendingCount} conversion${pendingCount === 1 ? "" : "s"} queued.`,
      };
    }

    const completedCount = conversions.filter((conv) => conv.status === "completed").length;
    if (completedCount === conversions.length) {
      return {
        label: "Ready",
        tone: "success" as const,
        icon: <CheckCircle2 className={iconSize} aria-hidden="true" />,
      };
    }

    return {
      label: "Attention",
      tone: "warning" as const,
      icon: <AlertTriangle className={iconSize} aria-hidden="true" />,
      description: "Review conversion status.",
    };
  }, [importStatus, conversions]);

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          BADGE_TONE_CLASS[status.tone],
        )}
        title={status.description ?? status.label}
      >
        {status.icon}
        {status.label}
      </span>
      {status.description ? (
        <span
          className={cn(
            "max-w-[220px] leading-snug",
            DESCRIPTION_TONE_CLASS[status.tone],
          )}
          title={status.description}
        >
          {status.description}
        </span>
      ) : null}
    </div>
  );
}

export default FileStatusIndicator;
