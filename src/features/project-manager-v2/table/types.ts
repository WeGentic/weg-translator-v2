import type { ProjectListItem } from "@/ipc";
import type { RowData } from "@tanstack/react-table";

export interface ProjectTableMeta {
  onRequestDelete?: (project: ProjectListItem) => void;
  onOpenProject?: (project: ProjectListItem) => void;
}

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    projectManager?: ProjectTableMeta;
  }
}

