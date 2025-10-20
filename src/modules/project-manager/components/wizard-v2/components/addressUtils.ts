export function resolveLanguageCode(locale: string | undefined): string {
  if (!locale) {
    return "en";
  }
  const [languageCode] = locale.split("-");
  return languageCode ? languageCode.toLowerCase() : "en";
}

export function generatePlacesSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}
