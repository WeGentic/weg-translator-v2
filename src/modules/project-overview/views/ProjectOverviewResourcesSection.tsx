import { useMemo } from "react";
import { Clock, Languages, Trash2, ExternalLink } from "lucide-react";

import type { ProjectFileBundle, ProjectLanguagePair } from "@/shared/types/database";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { AssetFilters } from "./ProjectOverviewAssetFilters";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type ResourceSectionProps = {
  title: string;
  description: string;
  emptyPlaceholder: string;
  items: ProjectFileBundle[];
  filters: AssetFilters;
  disabled?: boolean;
  onOpen?: (fileUuid: string) => void;
  onRemove?: (fileUuid: string) => void;
};

export function ProjectOverviewResourcesSection({
  title,
  description,
  emptyPlaceholder,
  items,
  filters,
  disabled = false,
  onOpen,
  onRemove,
}: ResourceSectionProps) {
  const cards = useMemo(() => items.map(mapBundleToCard), [items]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesSearch =
        filters.search.trim().length === 0 ||
        card.name.toLowerCase().includes(filters.search.trim().toLowerCase());

      const matchesRole = filters.role === "all" || card.role === filters.role;

      return matchesSearch && matchesRole;
    });
  }, [cards, filters]);

  return (
    <section className="project-overview__resources" aria-label={title}>
      <header className="project-overview__resources-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Badge variant="outline">{filteredCards.length} item{filteredCards.length === 1 ? "" : "s"}</Badge>
      </header>

      {filteredCards.length === 0 ? (
        <div className="project-overview__resources-empty">{emptyPlaceholder}</div>
      ) : (
        <div className="project-overview__resources-grid">
          {filteredCards.map((card) => (
            <article key={card.id} className="project-overview__resource-card">
              <div className="project-overview__resource-top">
                <div className="project-overview__resource-title">
                  <h3 title={card.name}>{card.name}</h3>
                  <Badge variant="secondary" className="uppercase tracking-wide">
                    {card.role}
                  </Badge>
                </div>
                <p className="project-overview__resource-meta">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Updated {card.updatedLabel}
                </p>
              </div>

              <div className="project-overview__resource-body">
                <dl>
                  <div>
                    <dt>Size</dt>
                    <dd>{card.sizeLabel}</dd>
                  </div>
                  <div>
                    <dt>Stored</dt>
                    <dd>{card.storedLabel}</dd>
                  </div>
                  <div>
                    <dt>Languages</dt>
                    <dd>
                      {card.languages.length > 0 ? (
                        <span className="project-overview__resource-languages">
                          <Languages className="h-3.5 w-3.5" aria-hidden />
                          {card.languages.join(", ")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <footer className="project-overview__resource-actions">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onOpen?.(card.id)}
                      disabled={!onOpen || disabled}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Open resource</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{onOpen ? "Open resource" : "Open coming soon"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove?.(card.id)}
                      disabled={!onRemove || disabled}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Remove resource</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{onRemove ? "Remove resource" : "Removal coming soon"}</TooltipContent>
                </Tooltip>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function mapBundleToCard(bundle: ProjectFileBundle) {
  return {
    id: bundle.file.fileUuid,
    name: bundle.file.filename,
    role: formatRole(bundle.file.type),
    sizeLabel: formatSize(bundle.info?.sizeBytes),
    storedLabel: formatStored(bundle.file.storedAt),
    updatedLabel: formatUpdated(bundle.file.storedAt),
    languages: deriveLanguages(bundle.languagePairs ?? []),
  };
}

function formatRole(role: string | undefined) {
  if (!role) return "resource";
  return role.replace(/[_-]/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatSize(size?: number | null) {
  if (typeof size !== "number" || Number.isNaN(size) || size <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = size;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUpdated(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "—";
  return DATE_FORMATTER.format(new Date(parsed));
}

function formatStored(stored: string) {
  if (!stored) return "—";
  return stored.split("/").slice(-3).join("/") || stored;
}

function deriveLanguages(pairs: ProjectLanguagePair[]) {
  if (!pairs || pairs.length === 0) return [];
  return pairs.map((pair) => `${pair.sourceLang} → ${pair.targetLang}`);
}
