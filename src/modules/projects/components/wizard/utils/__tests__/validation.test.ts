import { describe, expect, it } from "vitest";

import { validateDetails, validateFiles } from "@/modules/projects/components/wizard/utils/validation";
import type { NewProjectForm } from "@/modules/projects/components/wizard/types";

const baseForm: NewProjectForm = {
  name: "My Project",
  type: "translation",
  srcLang: "en-US",
  tgtLang: "it-IT",
  files: ["/abs/file.docx"],
};

describe("wizard validation", () => {
  it("rejects invalid BCP-47 tags", () => {
    const invalidSrc = validateDetails({ ...baseForm, srcLang: "en_US" });
    expect(invalidSrc.valid).toBe(false);
    expect(invalidSrc.errors.srcLang).toBeTruthy();

    const invalidTgt = validateDetails({ ...baseForm, tgtLang: "it".repeat(40) });
    expect(invalidTgt.valid).toBe(false);
    expect(invalidTgt.errors.tgtLang).toBeTruthy();
  });

  it("requires distinct source/target languages", () => {
    const same = validateDetails({ ...baseForm, srcLang: "en-US", tgtLang: "en-US" });
    expect(same.valid).toBe(false);
    expect(same.errors.tgtLang).toMatch(/must differ/i);
  });

  it("rejects unsupported file extensions", () => {
    const bad = validateFiles({ ...baseForm, files: ["/abs/file.xyz"] });
    expect(bad.valid).toBe(false);
    expect(bad.errors.files).toBeTruthy();
  });

  it("accepts supported file extensions", () => {
    const ok = validateFiles({ ...baseForm, files: ["/abs/file.pptx", "/abs/file.html", "/abs/file.xliff"] });
    expect(ok.valid).toBe(true);
  });
});
