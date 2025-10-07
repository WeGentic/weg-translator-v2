import type {
  JliffRoot,
  JliffTransunit,
  PlaceholderChip,
  PlaceholderCounts,
  PlaceholderParityStatus,
  SegmentIssues,
  SegmentRow,
  SegmentToken,
  TagsPlaceholder,
  TagsRoot,
  TagsSegment,
  TagsUnit,
} from "./types";
import {
  composeTokenCacheKey,
  mkSegmentKey,
  parseSegmentKey,
  tokenizeText,
} from "./tokenize";

interface PlaceholderStats {
  frequency: Map<string, number>;
  sequence: string[];
  total: number;
  unknown: string[];
}

interface NormalizeOptions {
  version?: number;
}

export function normalizeJliffArtifacts(
  jliff: JliffRoot,
  tags: TagsRoot,
  options: NormalizeOptions = {},
): SegmentRow[] {
  const version = options.version ?? 0;
  const transunitMap = buildTransunitMap(jliff.Transunits);
  const remainingKeys = new Set(transunitMap.keys());
  const rows: SegmentRow[] = [];

  for (const unit of tags.units) {
    for (const segment of unit.segments) {
      const key = mkSegmentKey(unit.unit_id, segment.segment_id);
      const transunit = transunitMap.get(key);
      if (transunit) {
        remainingKeys.delete(key);
      }
      rows.push(
        buildSegmentRow({
          key,
          unit,
          segment,
          transunit,
          version,
        }),
      );
    }
  }

  for (const key of remainingKeys) {
    const transunit = transunitMap.get(key);
    if (!transunit) {
      continue;
    }
    const { unitId } = parseSegmentKey(key);
    rows.push(
      buildSegmentRow({
        key,
        unit: { unit_id: unitId, segments: [] },
        segment: undefined,
        transunit,
        version,
      }),
    );
  }

  return rows;
}

function buildTransunitMap(transunits: JliffTransunit[]): Map<string, JliffTransunit> {
  const map = new Map<string, JliffTransunit>();
  for (const tu of transunits) {
    const unitId = tu["unit id"];
    const key = mkSegmentKey(unitId, tu.transunit_id);
    map.set(key, tu);
  }
  return map;
}

interface BuildSegmentRowParams {
  key: string;
  unit: TagsUnit;
  segment?: TagsSegment;
  transunit?: JliffTransunit;
  version: number;
}

function buildSegmentRow({
  key,
  unit,
  segment,
  transunit,
  version,
}: BuildSegmentRowParams): SegmentRow {
  const unitId = unit.unit_id;
  const segmentId = segment?.segment_id ?? transunit?.transunit_id ?? "";
  const sourceRaw = transunit?.Source ?? "";
  const targetRaw = transunit?.Target_translation ?? "";

  const placeholders = segment
    ? buildPlaceholderChips(segment.placeholders_in_order)
    : [];
  const knownPlaceholderTokens = new Set(placeholders.map((chip) => chip.token));

  const sourceTokens = tokenizeText(
    sourceRaw,
    composeTokenCacheKey(key, "source", sourceRaw, version),
  );
  const targetTokens = tokenizeText(
    targetRaw,
    composeTokenCacheKey(key, "target", targetRaw, version),
  );

  let placeholderCounts: PlaceholderCounts = {
    source: 0,
    target: 0,
    missing: 0,
    extra: 0,
  };
  let status: PlaceholderParityStatus = "unknown";
  let issues: SegmentIssues | null = null;

  if (segment && transunit) {
    const sourceStats = collectPlaceholderStats(sourceTokens, knownPlaceholderTokens);
    const targetStats = collectPlaceholderStats(targetTokens, knownPlaceholderTokens);

    const missing = computeMissing(sourceStats.frequency, targetStats.frequency);
    const extra = computeMissing(targetStats.frequency, sourceStats.frequency);
    const orderMismatch = detectOrderMismatch(sourceStats.sequence, targetStats.sequence);

    placeholderCounts = {
      source: sourceStats.total,
      target: targetStats.total,
      missing,
      extra,
    };

    status = determineStatus({ missing, extra, orderMismatch, sourceStats, targetStats });

    const shouldAttachIssues =
      status !== "ok" ||
      sourceStats.unknown.length > 0 ||
      targetStats.unknown.length > 0 ||
      orderMismatch;

    if (shouldAttachIssues) {
      issues = {
        unknownSource: sourceStats.unknown,
        unknownTarget: targetStats.unknown,
        orderMismatch,
      };
    }
  }

  return {
    key,
    unitId,
    segmentId,
    sourceRaw,
    targetRaw,
    sourceTokens,
    targetTokens,
    placeholders,
    placeholderCounts,
    status,
    issues,
  };
}

function buildPlaceholderChips(placeholders: TagsPlaceholder[]): PlaceholderChip[] {
  return placeholders.map((placeholder, index) => ({
    id: placeholder.id ?? `${placeholder.elem}-${index}`,
    token: placeholder.placeholder,
    originalData: placeholder.originalData,
    elem: placeholder.elem,
    attrs: placeholder.attrs,
  }));
}

function collectPlaceholderStats(
  tokens: SegmentToken[],
  knownTokens: Set<string>,
): PlaceholderStats {
  const frequency = new Map<string, number>();
  const sequence: string[] = [];
  const unknown = new Set<string>();

  for (const token of tokens) {
    if (token.kind !== "ph") {
      continue;
    }
    const raw = token.value;
    sequence.push(raw);
    frequency.set(raw, (frequency.get(raw) ?? 0) + 1);
    if (!knownTokens.has(raw)) {
      unknown.add(raw);
    }
  }

  return {
    frequency,
    sequence,
    total: sequence.length,
    unknown: [...unknown],
  };
}

function computeMissing(
  reference: Map<string, number>,
  comparison: Map<string, number>,
): number {
  let delta = 0;
  for (const [placeholder, count] of reference) {
    const comparisonCount = comparison.get(placeholder) ?? 0;
    if (count > comparisonCount) {
      delta += count - comparisonCount;
    }
  }
  return delta;
}

function detectOrderMismatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return true;
    }
  }
  return false;
}

interface StatusParams {
  missing: number;
  extra: number;
  orderMismatch: boolean;
  sourceStats: PlaceholderStats;
  targetStats: PlaceholderStats;
}

function determineStatus({
  missing,
  extra,
  orderMismatch,
  sourceStats,
  targetStats,
}: StatusParams): PlaceholderParityStatus {
  if (
    sourceStats.unknown.length > 0 ||
    targetStats.unknown.length > 0 ||
    orderMismatch
  ) {
    return "unknown";
  }
  if (missing > 0 && extra > 0) {
    return "unknown";
  }
  if (missing > 0) {
    return "missing";
  }
  if (extra > 0) {
    return "extra";
  }
  return "ok";
}

export const __TEST_ONLY__ = {
  collectPlaceholderStats,
  computeMissing,
  detectOrderMismatch,
  determineStatus,
};
