/**
 * @file Helper utilities shared across wizard components and hooks.
 */

import type { EnhancedLanguageOption, FileRoleValue } from "./types";
import { IMAGE_EXTENSIONS } from "./constants";
import type { LanguageOption } from "../wizard/utils/languages";

/**
 * Resolves the filename from a filesystem path, regardless of the platform.
 */
export function extractFileName(filePath: string): string {
  const segments = filePath.split(/[/\\]/);
  return segments.pop() || filePath;
}

/**
 * Returns the filename without its last extension segment.
 */
export function extractFileStem(fileName: string): string {
  const terminal = extractFileName(fileName);
  const lastDot = terminal.lastIndexOf(".");
  if (lastDot <= 0) {
    return terminal;
  }
  return terminal.slice(0, lastDot);
}

/**
 * Extracts the terminal extension of a filename (uppercase) or returns an em dash
 * placeholder when no extension is present. The em dash matches the previous UI.
 */
export function extractFileExtension(fileName: string): string {
  if (!fileName.includes(".")) {
    return "—";
  }
  const ext = fileName.split(".").pop();
  if (!ext) {
    return "—";
  }
  return ext.toUpperCase();
}

/**
 * Guesses a reasonable default file role using the extension alone. Image files
 * are auto-tagged as "image" while every other format defaults to "processable".
 */
export function inferDefaultRoleFromExtension(extension: string): FileRoleValue {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  return "processable";
}

/**
 * Creates a Map lookup that stores each language option by its code alongside a
 * short label optimised for chips and list items.
 */
export function createLanguageMap(options: readonly LanguageOption[]): Map<string, EnhancedLanguageOption> {
  return new Map(
    options.map((option) => {
      const compactLabel = option.label.replace(/\s*\(.*?\)\s*/g, "").trim();
      return [option.code, { ...option, compactLabel }];
    }),
  );
}

/**
 * Joins filesystem path segments while preserving the dominant separator found in
 * the first segment. Trailing and leading separators are trimmed to avoid double
 * separators when composing absolute paths across platforms.
 */
export function joinPathSegments(...segments: string[]): string {
  if (segments.length === 0) {
    return "";
  }

  const trimmedSegments = segments.map((segment, index) => {
    if (segment.length === 0) {
      return "";
    }
    let next = segment;
    if (index === 0) {
      next = next.replace(/[/\\]+$/g, "");
    } else {
      next = next.replace(/^[\\/]+/, "").replace(/[/\\]+$/g, "");
    }
    return next;
  });

  const first = trimmedSegments[0];
  const separator =
    first.includes("\\") && !first.includes("/") ? "\\" : "/";

  return trimmedSegments
    .filter((segment, index) => segment.length > 0 || index === 0)
    .join(separator);
}
