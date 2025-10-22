import { isWellFormedBcp47 } from "@/shared/utils/validation";
import type { ProjectLanguagePair } from "@/shared/types/database";

export class LanguagePairError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanguagePairError";
  }
}

export function buildLanguagePairs(
  source: string | null,
  targets: readonly string[],
): ProjectLanguagePair[] {
  const trimmedSource = source?.trim();
  if (!trimmedSource) {
    throw new LanguagePairError("Source language is required.");
  }

  if (!isWellFormedBcp47(trimmedSource)) {
    throw new LanguagePairError("Provide a valid BCP‑47 source language (e.g. en-US).");
  }

  const normalizedSource = trimmedSource.toLowerCase();
  const uniqueTargets = new Set<string>();
  const pairs: ProjectLanguagePair[] = [];

  for (const target of targets) {
    const trimmedTarget = target.trim();
    if (!trimmedTarget) {
      continue;
    }

    if (!isWellFormedBcp47(trimmedTarget)) {
      throw new LanguagePairError(`Invalid BCP‑47 target language: ${trimmedTarget}`);
    }

    const normalizedTarget = trimmedTarget.toLowerCase();
    if (normalizedTarget === normalizedSource) {
      throw new LanguagePairError("Source and target languages must be different.");
    }

    if (uniqueTargets.has(normalizedTarget)) {
      continue;
    }

    uniqueTargets.add(normalizedTarget);
    pairs.push({
      sourceLang: trimmedSource,
      targetLang: trimmedTarget,
    });
  }

  if (pairs.length === 0) {
    throw new LanguagePairError("Add at least one target language.");
  }

  return pairs;
}
