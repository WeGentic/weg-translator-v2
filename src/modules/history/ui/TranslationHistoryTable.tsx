import type { TranslationHistoryRecord } from "@/core/ipc";
import { cn } from "@/shared/utils/class-names";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  failed: "bg-destructive/15 text-destructive",
};

export interface TranslationHistoryTableProps {
  records: TranslationHistoryRecord[];
  isLoading?: boolean;
  selectedJobId?: string | null;
  onSelectRecord?: (record: TranslationHistoryRecord) => void;
  emptyMessage?: string;
}

export function TranslationHistoryTable({
  records,
  isLoading = false,
  selectedJobId,
  onSelectRecord,
  emptyMessage = "No translation history yet.",
}: TranslationHistoryTableProps) {
  const hasRecords = records.length > 0;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[15%]">Job</TableHead>
            <TableHead className="w-[25%]">Languages</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[15%]">Duration</TableHead>
            <TableHead className="w-[30%]">Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !hasRecords ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                Loading history…
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading && !hasRecords ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}

          {records.map((record) => {
            const { job, output } = record;
            const jobId = job.jobId;
            const status = String(job.status).toLowerCase();
            const statusStyle = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
            const durationLabel = formatDuration(output?.durationMs ?? null);
            const updatedLabel = formatTimestamp(job.updatedAt);
            const rowIsSelected = selectedJobId === jobId;
            const isInteractive = typeof onSelectRecord === "function";

            return (
              <TableRow
                key={jobId}
                data-selected={rowIsSelected ? "true" : undefined}
                className={cn(
                  isInteractive && "cursor-pointer",
                  rowIsSelected && "bg-primary/10 hover:bg-primary/15",
                )}
                onClick={() => {
                  if (isInteractive) {
                    onSelectRecord(record);
                  }
                }}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-medium" title={jobId}>
                      {jobId.slice(0, 8)}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {job.stage}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span className="font-medium">
                      {job.sourceLanguage} → {job.targetLanguage}
                    </span>
                    <span className="text-xs text-muted-foreground truncate" title={job.inputText}>
                      {job.inputText || "(empty payload)"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize", statusStyle)}>
                    {status}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground/80">{durationLabel}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span>{updatedLabel}</span>
                    {output?.modelName ? (
                      <span className="text-xs text-muted-foreground">{output.modelName}</span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        {hasRecords ? (
          <TableCaption className="px-4 pb-4 pt-0 text-left text-xs text-muted-foreground/80">
            Showing {records.length} entr{records.length === 1 ? "y" : "ies"} from recent history.
          </TableCaption>
        ) : null}
      </Table>
    </div>
  );
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) {
    return "—";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  const seconds = durationMs / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} s`;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
