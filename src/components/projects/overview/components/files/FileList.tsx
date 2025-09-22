import { useMemo } from "react";

import type { ProjectFileWithConversionsDto } from "@/ipc";
import { Loader2 } from "lucide-react";
import { FileListItem } from "./FileListItem";

type Props = {
  files: ProjectFileWithConversionsDto[];
  isLoading?: boolean;
  onOpenEditor: (fileId: string) => void;
  onRemove: (fileId: string) => void;
};

export function FileList({ files, isLoading = false, onOpenEditor, onRemove }: Props) {
  const rows = useMemo(
    () =>
      files.map((row) => ({
        id: row.file.id,
        name: row.file.originalName,
        ext: row.file.ext,
        size: row.file.sizeBytes,
        importStatus: row.file.importStatus,
        conversions: row.conversions,
      })),
    [files],
  );

  return (
    <div className="px-0">
      {isLoading ? (
        <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : files.length > 0 ? (
        <ul role="list" className="divide-y divide-border/60">
          {rows.map((row) => (
            <FileListItem
              key={row.id}
              name={row.name}
              ext={row.ext}
              size={row.size}
              importStatus={row.importStatus}
              conversions={row.conversions}
              onOpenEditor={() => onOpenEditor(row.id)}
              onRemove={() => onRemove(row.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="px-6 py-4 text-sm text-muted-foreground">No files yet. Use "Add files" to import.</div>
      )}
    </div>
  );
}

export default FileList;
