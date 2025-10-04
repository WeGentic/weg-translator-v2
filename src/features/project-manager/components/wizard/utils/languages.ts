export interface LanguageOption {
  code: string;
  label: string;
  flag?: string;
}

// Curated set of common locales for quick selection.
// Codes are well-formed BCP-47 tags with region where applicable.
export const COMMON_LANGUAGES: LanguageOption[] = [
  { code: "en-US", label: "English (United States)", flag: "🇺🇸" },
  { code: "en-GB", label: "English (United Kingdom)", flag: "🇬🇧" },
  { code: "it-IT", label: "Italian (Italy)", flag: "🇮🇹" },
  { code: "es-ES", label: "Spanish (Spain)", flag: "🇪🇸" },
  { code: "de-DE", label: "German (Germany)", flag: "🇩🇪" },
  { code: "fr-FR", label: "French (France)", flag: "🇫🇷" },
  { code: "pt-BR", label: "Portuguese (Brazil)", flag: "🇧🇷" },
  { code: "pt-PT", label: "Portuguese (Portugal)", flag: "🇵🇹" },
  { code: "zh-CN", label: "Chinese (Simplified, China)", flag: "🇨🇳" },
  { code: "zh-TW", label: "Chinese (Traditional, Taiwan)", flag: "🇹🇼" },
  { code: "ja-JP", label: "Japanese (Japan)", flag: "🇯🇵" },
  { code: "ko-KR", label: "Korean (Korea)", flag: "🇰🇷" },
  { code: "ru-RU", label: "Russian (Russia)", flag: "🇷🇺" },
  { code: "ar-SA", label: "Arabic (Saudi Arabia)", flag: "🇸🇦" },
  { code: "nl-NL", label: "Dutch (Netherlands)", flag: "🇳🇱" },
  { code: "sv-SE", label: "Swedish (Sweden)", flag: "🇸🇪" },
  { code: "pl-PL", label: "Polish (Poland)", flag: "🇵🇱" },
  { code: "tr-TR", label: "Turkish (Turkey)", flag: "🇹🇷" },
  { code: "hi-IN", label: "Hindi (India)", flag: "🇮🇳" },
];

export function formatLanguageLabel(option: LanguageOption) {
  return `${option.flag ? option.flag + " " : ""}${option.label} — ${option.code}`;
}

export function isKnownLanguage(code: string) {
  const normalized = code.trim();
  return COMMON_LANGUAGES.some((l) => l.code.toLowerCase() === normalized.toLowerCase());
}

