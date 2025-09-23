import { Fragment } from "react";

import { Textarea } from "@/components/ui/textarea";
import type { SegmentRow } from "@/lib/jliff";
import { cn } from "@/lib/utils";

const CHIP_CLASS =
  "inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export type PlaceholderInspectorProps = {
  row: SegmentRow;
  className?: string;
};

export function PlaceholderInspector({ row, className }: PlaceholderInspectorProps) {
  const { placeholders, issues } = row;
  const placeholderCount = placeholders.length;

  return (
    <section
      className={cn("space-y-4", className)}
      aria-label={`Placeholder inspector for ${row.key}`}
      data-placeholder-count={placeholderCount}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Placeholder inspector</h3>
          <p className="text-xs text-muted-foreground">
            Detailed metadata for segment <span className="font-mono">{row.key}</span>.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {placeholderCount} placeholder{placeholderCount === 1 ? "" : "s"}
        </span>
      </header>

      {placeholderCount === 0 ? (
        <p className="text-sm text-muted-foreground">No placeholder metadata available for this segment.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {placeholders.map((placeholder) => (
              <span key={placeholder.id} className={CHIP_CLASS} data-ph-token={placeholder.token}>
                {placeholder.token}
              </span>
            ))}
          </div>

          <div className="grid gap-4" role="list">
            {placeholders.map((placeholder, index) => {
              const attributeEntries = Object.entries(placeholder.attrs ?? {});
              const hasAttributes = attributeEntries.length > 0;
              const hasOriginalData = Boolean(placeholder.originalData);

              return (
                <article
                  key={placeholder.id}
                  role="listitem"
                  className="rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Placeholder {index + 1}: <span className="font-mono">{placeholder.token}</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Element <span className="font-mono">{placeholder.elem ?? "?"}</span>
                      </p>
                    </div>
                  </header>

                  {hasAttributes ? (
                    <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      {attributeEntries.map(([name, value]) => (
                        <Fragment key={name}>
                          <dt className="font-medium uppercase tracking-wide text-muted-foreground/80">{name}</dt>
                          <dd className="font-mono text-[11px] text-foreground/80">
                            {value === null || value === undefined || value === "" ? "—" : value}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No attributes recorded for this placeholder.</p>
                  )}

                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80" htmlFor={`${row.key}-${placeholder.id}-original`}>
                      Original data snapshot
                    </label>
                    <Textarea
                      id={`${row.key}-${placeholder.id}-original`}
                      value={hasOriginalData ? placeholder.originalData : "No serialized original data was provided."}
                      readOnly
                      className={cn(
                        "font-mono text-xs",
                        !hasOriginalData && "text-muted-foreground",
                      )}
                      rows={5}
                      aria-label={`Original data snapshot for ${placeholder.token}`}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {issues ? (
        <aside className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700" role="status">
          <p className="font-semibold uppercase tracking-wide">Quality checks</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {issues.orderMismatch ? <li>Placeholder order in target differs from source.</li> : null}
            {issues.unknownSource.length > 0 ? (
              <li>
                Unknown source tokens: {issues.unknownSource.map((token) => (
                  <span key={token} className="font-mono">
                    {token}
                  </span>
                ))}
              </li>
            ) : null}
            {issues.unknownTarget.length > 0 ? (
              <li>
                Unknown target tokens: {issues.unknownTarget.map((token) => (
                  <span key={token} className="font-mono">
                    {token}
                  </span>
                ))}
              </li>
            ) : null}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}

export default PlaceholderInspector;
