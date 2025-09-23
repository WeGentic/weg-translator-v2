import { afterEach, describe, expect, it } from "vitest";

import {
  clearTokenCache,
  mkSegmentKey,
  normalizeJliffArtifacts,
  type JliffRoot,
  type TagsRoot,
} from "./index";

afterEach(() => clearTokenCache());

function buildFixtures(overrides?: {
  source?: string;
  target?: string;
  placeholder?: string;
}): { jliff: JliffRoot; tags: TagsRoot } {
  const placeholder = overrides?.placeholder ?? "{{ph:ph1}}";
  return {
    jliff: {
      Project_name: "Demo",
      Project_ID: "proj-1",
      File: "file.xlf",
      User: "tester",
      Source_language: "en",
      Target_language: "fr",
      Transunits: [
        {
          "unit id": "unit-1",
          transunit_id: "seg-1",
          Source: overrides?.source ?? `Hello ${placeholder}`,
          Target_translation: overrides?.target ?? `Bonjour ${placeholder}`,
        },
      ],
    },
    tags: {
      file_id: "file-1",
      original_path: "projects/demo/file.xlf",
      source_language: "en",
      target_language: "fr",
      placeholder_style: "double-curly",
      units: [
        {
          unit_id: "unit-1",
          segments: [
            {
              segment_id: "seg-1",
              placeholders_in_order: [
                {
                  placeholder,
                  elem: "ph",
                  id: "ph1",
                  attrs: {},
                  originalData: "<ph id='1'/>",
                },
              ],
              originalData_bucket: {
                ph1: "<ph id='1'/>",
              },
            },
          ],
        },
      ],
    },
  };
}

describe("normalizeJliffArtifacts", () => {
  it("produces rows with placeholder parity status ok when counts align", () => {
    const { jliff, tags } = buildFixtures();
    const rows = normalizeJliffArtifacts(jliff, tags);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.key).toBe(mkSegmentKey("unit-1", "seg-1"));
    expect(row.placeholderCounts).toEqual({ source: 1, target: 1, missing: 0, extra: 0 });
    expect(row.status).toBe("ok");
    expect(row.issues).toBeNull();
  });

  it("flags missing placeholders in the target string", () => {
    const { jliff, tags } = buildFixtures({ target: "Bonjour" });
    const [row] = normalizeJliffArtifacts(jliff, tags);
    expect(row.placeholderCounts).toMatchObject({ missing: 1, extra: 0 });
    expect(row.status).toBe("missing");
    expect(row.issues).not.toBeNull();
  });

  it("marks unknown placeholders when tokens are not in the tag map", () => {
    const { jliff, tags } = buildFixtures({ target: "Bonjour {{ph:ph2}}" });
    const [row] = normalizeJliffArtifacts(jliff, tags);
    expect(row.status).toBe("unknown");
    expect(row.issues).not.toBeNull();
    expect(row.issues?.unknownTarget).toContain("{{ph:ph2}}");
  });

  it("emits rows for transunits without tag metadata", () => {
    const { jliff, tags } = buildFixtures();
    jliff.Transunits.push({
      "unit id": "unit-2",
      transunit_id: "seg-2",
      Source: "Plain text",
      Target_translation: "Texte simple",
    });
    const rows = normalizeJliffArtifacts(jliff, tags);
    const loneRow = rows.find((row) => row.key === mkSegmentKey("unit-2", "seg-2"));
    expect(loneRow).toBeDefined();
    expect(loneRow?.placeholders).toHaveLength(0);
    expect(loneRow?.status).toBe("unknown");
  });
});
