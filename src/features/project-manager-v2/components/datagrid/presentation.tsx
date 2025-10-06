import { Database, Languages } from "lucide-react";
import type { ComponentType } from "react";

import type { ProjectStatus, ProjectType } from "../../types/types";

export type ProgressStatus = "pending" | "running" | "completed" | "failed";

export type StatusPresentation = {
  label: string;
  tone: "default" | "muted" | "destructive";
};

export type TypePresentation = {
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export const STATUS_PRESENTATION: Record<ProjectStatus, StatusPresentation> = {
  active: { label: "Active", tone: "default" },
  archived: { label: "Archived", tone: "muted" },
};

export const TYPE_PRESENTATION: Record<ProjectType, TypePresentation> = {
  translation: { label: "Translation", icon: Languages },
  rag: { label: "RAG", icon: Database },
};

export function StatusBadge({ tone, label }: StatusPresentation) {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-300 shadow-sm hover:shadow-md";

  const styles =
    tone === "destructive"
      ? "border border-[var(--color-tr-destructive)]/30 bg-[var(--color-tr-destructive)]/10 text-[var(--color-tr-destructive)] hover:bg-[var(--color-tr-destructive)]/20 hover:border-[var(--color-tr-destructive)]/50 hover:scale-105"
      : tone === "muted"
      ? "border border-[var(--color-tr-muted)]/30 bg-[var(--color-tr-muted)]/10 text-[var(--color-tr-muted-foreground)] hover:bg-[var(--color-tr-muted)]/20 hover:border-[var(--color-tr-muted)]/50 hover:scale-105"
      : "border border-[var(--color-tr-primary-blue)]/30 bg-[var(--color-tr-primary-blue)]/10 text-[var(--color-tr-primary-blue)] hover:bg-[var(--color-tr-primary-blue)]/20 hover:border-[var(--color-tr-primary-blue)]/50 hover:scale-105";

  return (
    <span className={`${base} ${styles} relative overflow-hidden`}>
      <span className="relative z-10">{label}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
    </span>
  );
}

export const PROGRESS_PRESENTATION: Record<ProgressStatus, StatusPresentation> = {
  pending: { label: "Pending", tone: "muted" },
  running: { label: "Running", tone: "default" },
  completed: { label: "Completed", tone: "default" },
  failed: { label: "Failed", tone: "destructive" },
};
