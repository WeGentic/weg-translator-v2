import type { SegmentToken } from "./types";

const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z0-9_]+:[^{}]+?)\}\}/g;

export interface PlaceholderDetails {
  raw: string;
  type: string;
  id: string | null;
  suffix: string | null;
}

export function mkSegmentKey(unitId: string, segmentId: string): string {
  return `u${unitId}-s${segmentId}`;
}

export function parseSegmentKey(key: string): {
  unitId: string;
  segmentId: string;
} {
  if (!key.startsWith("u")) {
    return {
      unitId: "",
      segmentId: "",
    };
  }

  const trimmed = key.slice(1);
  const separatorIndex = trimmed.lastIndexOf("-s");
  if (separatorIndex === -1) {
    return {
      unitId: trimmed,
      segmentId: "",
    };
  }

  const unitId = trimmed.slice(0, separatorIndex);
  const segmentId = trimmed.slice(separatorIndex + 2);

  return {
    unitId,
    segmentId,
  };
}

export function composeTokenCacheKey(
  segmentKey: string,
  variant: "source" | "target",
  text: string,
  version = 0,
): string {
  return `${segmentKey}::${variant}::${version}::${text}`;
}

export function parsePlaceholder(raw: string): PlaceholderDetails {
  const trimmed = raw.slice(2, -2);
  const parts = trimmed.split(":");
  const [type = "", id = null, ...rest] = parts;
  const suffix = rest.length > 0 ? rest.join(":") : null;

  return {
    raw,
    type,
    id,
    suffix,
  };
}

const tokenCache = new Map<string, SegmentToken[]>();

export function clearTokenCache() {
  tokenCache.clear();
}

export function tokenizeText(text: string, cacheKey?: string): SegmentToken[] {
  const effectiveKey = cacheKey ?? text;
  const cached = tokenCache.get(effectiveKey);
  if (cached) {
    return cached;
  }

  const tokens: SegmentToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({ kind: "text", value: text.slice(lastIndex, index) });
    }

    const details = parsePlaceholder(raw);
    tokens.push({
      kind: "ph",
      value: raw,
      placeholderId: details.id ?? undefined,
    });

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: "text", value: text.slice(lastIndex) });
  }

  tokenCache.set(effectiveKey, tokens);
  return tokens;
}

export function extractPlaceholderTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    tokens.push(match[0]);
  }
  return tokens;
}

export const __TEST_ONLY__ = {
  PLACEHOLDER_PATTERN,
  tokenCache,
};
