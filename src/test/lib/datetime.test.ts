import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { formatDateParts } from "@/shared/utils/datetime";

describe("formatDateParts", () => {
  const fixedNow = new Date("2025-01-01T12:00:00.000Z");
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns em dash parts for invalid date", () => {
    const res = formatDateParts("not-a-date");
    expect(res).toMatchObject({ label: "—", detail: "—", relative: "—" });
  });

  it("formats label/detail and relative time", () => {
    const past = new Date("2024-12-31T12:00:00.000Z");
    const res = formatDateParts(past.toISOString());
    expect(res.label).toBeTypeOf("string");
    expect(res.detail).toBeTypeOf("string");
    expect(res.relative.toLowerCase()).toContain("day");
  });
});
