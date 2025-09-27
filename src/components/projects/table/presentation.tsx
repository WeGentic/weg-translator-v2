import { Database, Languages } from "lucide-react";
import type { ComponentType } from "react";

import type { ProjectStatus, ProjectType } from "./types";
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
      ? "border border-red-200/60 bg-gradient-to-r from-red-50 to-red-100/80 text-red-700 hover:from-red-100 hover:to-red-200/80 hover:border-red-300/60 hover:scale-105"
      : tone === "muted"
      ? "border border-gray-200/50 bg-gradient-to-r from-gray-50/60 to-gray-100/80 text-gray-600 hover:from-gray-100/60 hover:to-gray-200/80 hover:border-gray-300/50 hover:scale-105"
      : "border border-blue-200/60 bg-gradient-to-r from-blue-50 to-blue-100/80 text-blue-700 hover:from-blue-100 hover:to-blue-200/80 hover:border-blue-300/60 hover:scale-105";
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
