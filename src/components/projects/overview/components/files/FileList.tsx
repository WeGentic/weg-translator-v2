import { useMemo } from "react";

import type { ProjectFileWithConversionsDto } from "@/ipc";
import { Loader2 } from "lucide-react";
import { FileListItem } from "./FileListItem";

type Props = {
  files: ProjectFileWithConversionsDto[];
  isLoading?: boolean;
  onOpenEditor: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onRebuild: (fileId: string) => void;
  rebuildingFileId?: string | null;
};

export function FileList({ files, isLoading = false, onOpenEditor, onRemove, onRebuild, rebuildingFileId }: Props) {
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading files…
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="px-6 py-10 text-center text-sm text-muted-foreground">No files yet. Use the add button to import.</div>;
  }

  return (
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
          onRebuild={() => onRebuild(row.id)}
          onRemove={() => onRemove(row.id)}
          isRebuilding={rebuildingFileId === row.id}
        />
      ))}
    </ul>
  );
}

export default FileList;
