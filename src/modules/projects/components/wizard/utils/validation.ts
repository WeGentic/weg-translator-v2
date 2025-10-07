import { ALLOWED_EXTENSIONS, type NewProjectForm, type ProjectFormErrors } from "../types";
import { isWellFormedBcp47 } from "@/shared/utils/validation";

export function validateDetails(form: NewProjectForm) {
  const errors: ProjectFormErrors = {};
  const trimmed = form.name.trim();

  if (trimmed.length < 2 || trimmed.length > 120) {
    errors.name = "Name must be between 2 and 120 characters.";
  } else if (!/[\p{Letter}\p{Number}]/u.test(trimmed)) {
    errors.name = "Name must include at least one letter or number.";
  }

  if (form.type !== "translation" && form.type !== "rag") {
    errors.type = "Select a project type.";
  }

  const src = form.srcLang.trim();
  const tgt = form.tgtLang.trim();
  if (src.length === 0) {
    errors.srcLang = "Source language is required.";
  } else if (!isWellFormedBcp47(src)) {
    errors.srcLang = "Enter a well‑formed BCP‑47 tag (e.g. en-US).";
  }

  if (tgt.length === 0) {
    errors.tgtLang = "Target language is required.";
  } else if (!isWellFormedBcp47(tgt)) {
    errors.tgtLang = "Enter a well‑formed BCP‑47 tag (e.g. it-IT).";
  }

  if (!errors.srcLang && !errors.tgtLang && src.toLowerCase() === tgt.toLowerCase()) {
    errors.tgtLang = "Source and target languages must differ.";
  }

  return { valid: Object.keys(errors).length === 0, errors } as const;
}

export function validateFiles(form: NewProjectForm) {
  const errors: ProjectFormErrors = {};

  if (form.files.length === 0) {
    errors.files = "Add at least one file.";
  }

  const invalidExtension = form.files.find((filePath) => {
    const extension = filePath.split(".").pop()?.toLowerCase();
    return !extension || !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number]);
  });

  if (invalidExtension) {
    errors.files = "One or more files have unsupported extensions.";
  }

  return { valid: Object.keys(errors).length === 0, errors } as const;
}

export function validateAll(form: NewProjectForm) {
  const details = validateDetails(form);
  const files = validateFiles(form);
  const merged: ProjectFormErrors = { ...details.errors, ...files.errors };
  const message = merged.name || merged.type || merged.files ? "Please fix the highlighted fields." : null;

  return { valid: details.valid && files.valid, errors: merged, message } as const;
}
