import { describe, expect, it } from "vitest";
import type { Row } from "@tanstack/react-table";

import type { SegmentRow } from "@/lib/jliff";
import { __TEST_ONLY__ } from "@/components/projects/editor/SegmentsTable";

const { placeholderFilter, normalizePlaceholderFilter } = __TEST_ONLY__;

function buildRow(partial: Partial<SegmentRow>): Row<SegmentRow> {
  const base: SegmentRow = {
    key: "u1-sseg-1",
    unitId: "1",
    segmentId: "seg-1",
    sourceRaw: "",
    targetRaw: "",
    sourceTokens: [],
    targetTokens: [],
    placeholders: [],
    placeholderCounts: { source: 0, target: 0, missing: 0, extra: 0 },
    status: "ok",
    issues: null,
  };

  return {
    id: base.key,
    original: { ...base, ...partial },
  } as Row<SegmentRow>;
}

describe("SegmentsTable placeholderFilter", () => {
  it("allows all rows when filter is falsy", () => {
    const row = buildRow({ status: "ok" });
    expect(placeholderFilter(row, "parity", undefined)).toBe(true);
  });

  it("filters out OK rows when mismatches only is enabled", () => {
    const okRow = buildRow({ status: "ok" });
    const missingRow = buildRow({ status: "missing" });

    expect(placeholderFilter(okRow, "parity", { mismatchesOnly: true })).toBe(false);
    expect(placeholderFilter(missingRow, "parity", { mismatchesOnly: true })).toBe(true);
  });

  it("filters rows without placeholders when required", () => {
    const emptyRow = buildRow({ placeholders: [] });
    const populatedRow = buildRow({
      placeholders: [{ id: "ph1", token: "{{ph:ph1}}" } as SegmentRow["placeholders"][number] ],
    });

    const value = { hasPlaceholdersOnly: true };
    expect(placeholderFilter(emptyRow, "parity", value)).toBe(false);
    expect(placeholderFilter(populatedRow, "parity", value)).toBe(true);
  });

  it("filters rows by specific status", () => {
    const missingRow = buildRow({ status: "missing" });
    const extraRow = buildRow({ status: "extra" });

    const value = { status: "missing" };
    expect(placeholderFilter(missingRow, "parity", value)).toBe(true);
    expect(placeholderFilter(extraRow, "parity", value)).toBe(false);
  });
});

describe("SegmentsTable normalizePlaceholderFilter", () => {
  it("returns undefined when no flags are set", () => {
    expect(normalizePlaceholderFilter({})).toBeUndefined();
  });

  it("preserves truthy flags", () => {
    expect(
      normalizePlaceholderFilter({ mismatchesOnly: true, hasPlaceholdersOnly: true, status: "missing" }),
    ).toEqual({ mismatchesOnly: true, hasPlaceholdersOnly: true, status: "missing" });
  });

  it("removes undefined properties", () => {
    expect(normalizePlaceholderFilter({ mismatchesOnly: undefined, status: undefined })).toBeUndefined();
  });
});
