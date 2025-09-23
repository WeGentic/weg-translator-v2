import type { SegmentToken } from "@/lib/jliff";
import { cn } from "@/lib/utils";

const CHIP_BASE_CLASS =
  "inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-muted/60";

const TEXT_CLASS = "whitespace-pre-wrap break-words text-sm text-foreground";

export type TokenLineProps = {
  tokens: SegmentToken[];
  className?: string;
  direction?: "source" | "target";
  onPlaceholderClick?: (placeholderToken: SegmentToken) => void;
};

export function TokenLine({ tokens, className, direction, onPlaceholderClick }: TokenLineProps) {
  if (!tokens || tokens.length === 0) {
    return <span className="text-sm italic text-muted-foreground">(empty)</span>;
  }

  const keyCounters = new Map<string, number>();

  return (
    <div className={cn("flex flex-wrap items-start gap-1", className)} data-direction={direction}>
      {tokens.map((token) => {
        const keyBase =
          token.kind === "text"
            ? `text:${token.value}`
            : `ph:${token.placeholderId ?? token.value}`;
        const occurrence = keyCounters.get(keyBase) ?? 0;
        keyCounters.set(keyBase, occurrence + 1);
        const elementKey = `${keyBase}:${occurrence}`;

        if (token.kind === "text") {
          return (
            <span key={elementKey} className={TEXT_CLASS}>
              {token.value}
            </span>
          );
        }

        const handleClick = onPlaceholderClick
          ? () => {
              onPlaceholderClick(token);
            }
          : undefined;

        return (
          <button
            key={elementKey}
            type="button"
            className={CHIP_BASE_CLASS}
            data-ph={token.value}
            data-ph-id={token.placeholderId ?? undefined}
            aria-label={`Placeholder ${token.value}`}
            onClick={handleClick}
            disabled={!onPlaceholderClick}
          >
            {token.value}
          </button>
        );
      })}
    </div>
  );
}

export default TokenLine;
