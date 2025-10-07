import type { TranslationStatus } from "@/core/ipc";

export type HistoryStatusFilter = Extract<TranslationStatus, "completed" | "failed">;

export interface TranslationHistoryFilters {
  statuses: HistoryStatusFilter[];
}

export const DEFAULT_HISTORY_FILTERS: TranslationHistoryFilters = {
  statuses: ["completed", "failed"],
};
