/**
 * @file Utilities for deriving filesystem-safe project folder names.
 *
 * Folder slugs must remain portable across Windows and macOS, so we keep the
 * character set conservative (lowercase alphanumerics plus hyphen) and apply
 * Unicode normalisation before stripping diacritics and illegal characters.
 * When a sanitized slug collides with an existing folder, a deterministic
 * numeric suffix keeps the name unique while preserving readability.
 */

const CONTROL_CHAR_RANGE = "\\u0000-\\u001F";
const INVALID_FOLDER_CHARS = new RegExp(`[<>:"/\\\\|?*${CONTROL_CHAR_RANGE}]`, "g");
const SEQUENTIAL_SPACES = /\s+/g;
const MULTIPLE_DASHES = /-+/g;
const LEADING_OR_TRAILING_DASH = /^-+|-+$/g;
const NON_ALLOWED_CHARS = /[^a-z0-9-]/g;
const RESERVED_WINDOWS_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export const PROJECT_FOLDER_MAX_LENGTH = 120;

export interface GenerateProjectFolderOptions {
  /**
   * Optional collection of folder names already in use. Each entry is compared
   * case-insensitively to avoid collisions on case-insensitive filesystems.
   */
  existingNames?: Iterable<string>;
}

export function sanitizeProjectFolderName(rawName: string): string {
  if (!rawName.trim()) {
    return "";
  }

  const normalised = rawName.normalize("NFKC");
  const withoutForbidden = normalised.replace(INVALID_FOLDER_CHARS, " ");
  const collapsedWhitespace = withoutForbidden.replace(SEQUENTIAL_SPACES, " ").trim();

  if (!collapsedWhitespace) {
    return "";
  }

  const ascii = removeDiacritics(collapsedWhitespace).toLowerCase();
  const safeCharacters = ascii.replace(NON_ALLOWED_CHARS, "-").replace(MULTIPLE_DASHES, "-");
  const trimmed = safeCharacters.replace(LEADING_OR_TRAILING_DASH, "");

  if (!trimmed) {
    return "";
  }

  const reservedSafe = RESERVED_WINDOWS_NAMES.has(trimmed.toUpperCase())
    ? `_${trimmed}`
    : trimmed;

  return reservedSafe.slice(0, PROJECT_FOLDER_MAX_LENGTH);
}

export function generateUniqueProjectFolderName(
  desiredName: string,
  options?: GenerateProjectFolderOptions,
): string {
  const base = sanitizeProjectFolderName(desiredName);
  if (!base) {
    return "";
  }

  const existing = new Set<string>();
  if (options?.existingNames) {
    for (const name of options.existingNames) {
      existing.add(name.toLowerCase());
    }
  }

  if (!existing.has(base.toLowerCase())) {
    return base;
  }

  let counter = 2;
  let candidate = appendSuffix(base, counter);
  while (existing.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = appendSuffix(base, counter);
  }

  return candidate;
}

function appendSuffix(value: string, counter: number): string {
  const suffix = `-${counter}`;
  const maxLength = PROJECT_FOLDER_MAX_LENGTH;
  if (value.length + suffix.length <= maxLength) {
    return `${value}${suffix}`;
  }

  const truncatedBase = value.slice(0, Math.max(1, maxLength - suffix.length));
  const cleanedBase = truncatedBase.replace(LEADING_OR_TRAILING_DASH, "") || value.charAt(0);
  return `${cleanedBase}${suffix}`;
}

function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
