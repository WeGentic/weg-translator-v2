import { describe, expect, it } from "vitest";

import { buildLanguagePairs, LanguagePairError } from "../languagePairs";

describe("buildLanguagePairs", () => {
  it("creates pairs for unique targets", () => {
    const pairs = buildLanguagePairs("en-US", ["it-IT", "fr-FR"]);
    expect(pairs).toEqual([
      { sourceLang: "en-US", targetLang: "it-IT" },
      { sourceLang: "en-US", targetLang: "fr-FR" },
    ]);
  });

  it("filters duplicate targets", () => {
    const pairs = buildLanguagePairs("en-US", ["it-IT", "IT-it", "de-DE"]);
    expect(pairs).toEqual([
      { sourceLang: "en-US", targetLang: "it-IT" },
      { sourceLang: "en-US", targetLang: "de-DE" },
    ]);
  });

  it("throws when source missing", () => {
    expect(() => buildLanguagePairs(null, ["it-IT"])).toThrow(LanguagePairError);
  });

  it("throws when any target equals source", () => {
    expect(() => buildLanguagePairs("en-US", ["en-US"])).toThrow(LanguagePairError);
  });

  it("throws when no valid targets remain", () => {
    expect(() => buildLanguagePairs("en-US", [])).toThrow(LanguagePairError);
    expect(() => buildLanguagePairs("en-US", ["   "])).toThrow(LanguagePairError);
  });
});
