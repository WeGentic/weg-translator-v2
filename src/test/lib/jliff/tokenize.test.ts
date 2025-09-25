import { afterEach, describe, expect, it } from "vitest";

import {
  clearTokenCache,
  composeTokenCacheKey,
  mkSegmentKey,
  parsePlaceholder,
  parseSegmentKey,
  tokenizeText,
} from "@/lib/jliff";

describe("tokenizeText", () => {
  afterEach(() => clearTokenCache());

  it("splits text into text and placeholder tokens", () => {
    const tokens = tokenizeText("Hello {{ph:ph1}} world");
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toMatchObject({ kind: "text", value: "Hello " });
    expect(tokens[1]).toMatchObject({ kind: "ph", value: "{{ph:ph1}}", placeholderId: "ph1" });
    expect(tokens[2]).toMatchObject({ kind: "text", value: " world" });
  });

  it("reuses cached results when the same cache key is provided", () => {
    const key = composeTokenCacheKey("uunit-sseg", "source", "Hello", 0);
    const first = tokenizeText("Hello", key);
    const second = tokenizeText("Hello", key);
    expect(second).toBe(first);
  });
});

describe("placeholder helpers", () => {
  it("parses placeholder internals", () => {
    const details = parsePlaceholder("{{ph:ph1:auto}}");
    expect(details).toEqual({ raw: "{{ph:ph1:auto}}", type: "ph", id: "ph1", suffix: "auto" });
  });

  it("generates and parses segment keys", () => {
    const key = mkSegmentKey("unit-1", "seg-1");
    expect(key).toBe("uunit-1-sseg-1");
    expect(parseSegmentKey(key)).toEqual({ unitId: "unit-1", segmentId: "seg-1" });
  });
});
