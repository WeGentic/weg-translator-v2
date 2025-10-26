/**
 * Country-aware tax number configuration and helpers.
 * Patterns are derived from the European Commission VAT format guidance
 * (https://taxation-customs.ec.europa.eu) and cross-checked against
 * validator.js and jsVAT rule sets as of 2025-01.
 *
 * The module keeps formatting concerns isolated so the Zod schemas can reuse
 * the same metadata for messaging and validation.
 */

const COUNTRY_LABELS = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  DE: "Germany",
  EL: "Greece",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LV: "Latvia",
  LT: "Lithuania",
  LU: "Luxembourg",
  MT: "Malta",
  NL: "Netherlands",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SK: "Slovakia",
  SI: "Slovenia",
  ES: "Spain",
  SE: "Sweden",
} satisfies Record<string, string>;

type CanonicalCountryCode = keyof typeof COUNTRY_LABELS;

const COUNTRY_ALIAS_TO_CANONICAL: Record<string, CanonicalCountryCode> = {
  GR: "EL",
};

export const TAX_NUMBER_REQUIRED_MESSAGE = "Company tax number is required.";
export const TAX_NUMBER_UNSUPPORTED_MESSAGE =
  "Tax number validation is not available for the selected country yet.";

export interface TaxNumberFormat {
  /**
   * Regular expression applied to the normalized identifier (after stripping country prefix).
   */
  readonly regex: RegExp;
  /**
   * Example format rendered in validation error messages for clarity.
   */
  readonly example: string;
}

export interface TaxNumberRule {
  readonly countryCode: CanonicalCountryCode;
  readonly displayName: string;
  /**
   * Short description of the expected identifier structure.
   */
  readonly description: string;
  readonly formats: readonly TaxNumberFormat[];
  /**
   * Optional set of alternate prefixes that should be stripped before validation
   * (e.g., Greece uses the `EL` tax prefix while ISO country codes may emit `GR`).
   */
  readonly acceptedPrefixes?: readonly string[];
}

const TAX_NUMBER_RULES_CONFIG = {
  AT: {
    countryCode: "AT",
    displayName: COUNTRY_LABELS.AT,
    description: "prefix U followed by 8 digits",
    formats: [{ regex: /^U\d{8}$/, example: "U12345678" }],
    acceptedPrefixes: ["AT"],
  },
  BE: {
    countryCode: "BE",
    displayName: COUNTRY_LABELS.BE,
    description: "10 digits (leading zero allowed)",
    formats: [{ regex: /^\d{10}$/, example: "0123456789" }],
    acceptedPrefixes: ["BE"],
  },
  BG: {
    countryCode: "BG",
    displayName: COUNTRY_LABELS.BG,
    description: "9 or 10 digits",
    formats: [{ regex: /^\d{9,10}$/, example: "1234567890" }],
    acceptedPrefixes: ["BG"],
  },
  HR: {
    countryCode: "HR",
    displayName: COUNTRY_LABELS.HR,
    description: "11 digits",
    formats: [{ regex: /^\d{11}$/, example: "12345678901" }],
    acceptedPrefixes: ["HR"],
  },
  CY: {
    countryCode: "CY",
    displayName: COUNTRY_LABELS.CY,
    description: "8 digits followed by a letter",
    formats: [{ regex: /^\d{8}[A-Z]$/, example: "12345678X" }],
    acceptedPrefixes: ["CY"],
  },
  CZ: {
    countryCode: "CZ",
    displayName: COUNTRY_LABELS.CZ,
    description: "8 to 10 digits",
    formats: [{ regex: /^\d{8,10}$/, example: "1234567890" }],
    acceptedPrefixes: ["CZ"],
  },
  DK: {
    countryCode: "DK",
    displayName: COUNTRY_LABELS.DK,
    description: "8 digits",
    formats: [{ regex: /^\d{8}$/, example: "12345678" }],
    acceptedPrefixes: ["DK"],
  },
  EE: {
    countryCode: "EE",
    displayName: COUNTRY_LABELS.EE,
    description: "9 digits",
    formats: [{ regex: /^\d{9}$/, example: "123456789" }],
    acceptedPrefixes: ["EE"],
  },
  FI: {
    countryCode: "FI",
    displayName: COUNTRY_LABELS.FI,
    description: "8 digits",
    formats: [{ regex: /^\d{8}$/, example: "12345678" }],
    acceptedPrefixes: ["FI"],
  },
  FR: {
    countryCode: "FR",
    displayName: COUNTRY_LABELS.FR,
    description: "2 alphanumeric characters and 9 digits",
    formats: [{ regex: /^[0-9A-Z]{2}\d{9}$/, example: "AB123456789" }],
    acceptedPrefixes: ["FR"],
  },
  DE: {
    countryCode: "DE",
    displayName: COUNTRY_LABELS.DE,
    description: "9 digits",
    formats: [{ regex: /^\d{9}$/, example: "123456789" }],
    acceptedPrefixes: ["DE"],
  },
  EL: {
    countryCode: "EL",
    displayName: COUNTRY_LABELS.EL,
    description: "9 digits",
    formats: [{ regex: /^\d{9}$/, example: "123456789" }],
    acceptedPrefixes: ["EL", "GR"],
  },
  HU: {
    countryCode: "HU",
    displayName: COUNTRY_LABELS.HU,
    description: "8 digits",
    formats: [{ regex: /^\d{8}$/, example: "12345678" }],
    acceptedPrefixes: ["HU"],
  },
  IE: {
    countryCode: "IE",
    displayName: COUNTRY_LABELS.IE,
    description: "7 digits, 1 alphanumeric suffix, optional trailing W",
    formats: [{ regex: /^\d{7}[A-Z0-9]W?$/, example: "1234567HW" }],
    acceptedPrefixes: ["IE"],
  },
  IT: {
    countryCode: "IT",
    displayName: COUNTRY_LABELS.IT,
    description: "11 digits",
    formats: [{ regex: /^\d{11}$/, example: "12345678901" }],
    acceptedPrefixes: ["IT"],
  },
  LV: {
    countryCode: "LV",
    displayName: COUNTRY_LABELS.LV,
    description: "11 digits",
    formats: [{ regex: /^\d{11}$/, example: "12345678901" }],
    acceptedPrefixes: ["LV"],
  },
  LT: {
    countryCode: "LT",
    displayName: COUNTRY_LABELS.LT,
    description: "9 or 12 digits (legal entities/temporary)",
    formats: [
      { regex: /^\d{9}$/, example: "123456789" },
      { regex: /^\d{12}$/, example: "123456789012" },
    ],
    acceptedPrefixes: ["LT"],
  },
  LU: {
    countryCode: "LU",
    displayName: COUNTRY_LABELS.LU,
    description: "8 digits",
    formats: [{ regex: /^\d{8}$/, example: "12345678" }],
    acceptedPrefixes: ["LU"],
  },
  MT: {
    countryCode: "MT",
    displayName: COUNTRY_LABELS.MT,
    description: "8 digits",
    formats: [{ regex: /^\d{8}$/, example: "12345678" }],
    acceptedPrefixes: ["MT"],
  },
  NL: {
    countryCode: "NL",
    displayName: COUNTRY_LABELS.NL,
    description: "9 digits, letter B, and 2 check digits",
    formats: [{ regex: /^\d{9}B\d{2}$/, example: "123456789B01" }],
    acceptedPrefixes: ["NL"],
  },
  PL: {
    countryCode: "PL",
    displayName: COUNTRY_LABELS.PL,
    description: "10 digits",
    formats: [{ regex: /^\d{10}$/, example: "1234567890" }],
    acceptedPrefixes: ["PL"],
  },
  PT: {
    countryCode: "PT",
    displayName: COUNTRY_LABELS.PT,
    description: "9 digits",
    formats: [{ regex: /^\d{9}$/, example: "123456789" }],
    acceptedPrefixes: ["PT"],
  },
  RO: {
    countryCode: "RO",
    displayName: COUNTRY_LABELS.RO,
    description: "2 to 10 digits",
    formats: [{ regex: /^\d{2,10}$/, example: "1234567890" }],
    acceptedPrefixes: ["RO"],
  },
  SK: {
    countryCode: "SK",
    displayName: COUNTRY_LABELS.SK,
    description: "10 digits",
    formats: [{ regex: /^\d{10}$/, example: "1234567890" }],
    acceptedPrefixes: ["SK"],
  },
  SI: {
    countryCode: "SI",
    displayName: COUNTRY_LABELS.SI,
    description: "8 digits",
    formats: [{ regex: /^\d{8}$/, example: "12345678" }],
    acceptedPrefixes: ["SI"],
  },
  ES: {
    countryCode: "ES",
    displayName: COUNTRY_LABELS.ES,
    description: "Spanish NIF/VAT structures",
    formats: [
      { regex: /^[A-HJUV]\d{8}$/, example: "A12345678" },
      { regex: /^[A-HN-SW]\d{7}[A-J]$/, example: "B1234567J" },
      { regex: /^[0-9YZ]\d{7}[A-Z]$/, example: "X1234567L" },
      { regex: /^[KLMX]\d{7}[A-Z]$/, example: "K1234567L" },
    ],
    acceptedPrefixes: ["ES"],
  },
  SE: {
    countryCode: "SE",
    displayName: COUNTRY_LABELS.SE,
    description: "12 digits (YYMMDDXXXX format)",
    formats: [{ regex: /^\d{12}$/, example: "123456789012" }],
    acceptedPrefixes: ["SE"],
  },
} as const satisfies Record<CanonicalCountryCode, TaxNumberRule>;

export type TaxCountryCode = keyof typeof TAX_NUMBER_RULES_CONFIG;

export const SUPPORTED_TAX_COUNTRIES = Object.freeze(
  Object.keys(TAX_NUMBER_RULES_CONFIG) as TaxCountryCode[],
);

export type TaxNumberValidationResult =
  | { kind: "empty" }
  | { kind: "unsupported"; countryCode?: string | null }
  | { kind: "invalid_format"; countryCode: TaxCountryCode; message: string }
  | { kind: "valid"; countryCode: TaxCountryCode; normalized: string };

export function normalizeTaxNumber(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, "").toUpperCase();
}

export function resolveSupportedTaxCountry(
  candidate?: string | null,
): TaxCountryCode | undefined {
  if (!candidate) {
    return undefined;
  }
  const upper = candidate.toUpperCase();
  if (upper in TAX_NUMBER_RULES_CONFIG) {
    return upper as TaxCountryCode;
  }
  if (upper in COUNTRY_ALIAS_TO_CANONICAL) {
    return COUNTRY_ALIAS_TO_CANONICAL[upper];
  }
  return undefined;
}

function buildFormatMessage(rule: TaxNumberRule): string {
  const example = rule.formats[0]?.example;
  const suffix = example ? `, e.g. ${example}` : "";
  return `Enter a valid ${rule.displayName} tax number (${rule.description}${suffix}).`;
}

function stripCountryPrefix(value: string, rule: TaxNumberRule): string {
  const prefixes = rule.acceptedPrefixes ?? [];
  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }
  return value;
}

export function validateTaxNumberFormat(options: {
  value: string;
  countryCode?: string | null;
}): TaxNumberValidationResult {
  const normalized = normalizeTaxNumber(options.value);
  if (!normalized.length) {
    return { kind: "empty" };
  }

  const resolvedCountry = resolveSupportedTaxCountry(options.countryCode);
  if (!resolvedCountry) {
    return { kind: "unsupported", countryCode: options.countryCode ?? null };
  }

  const rule = TAX_NUMBER_RULES_CONFIG[resolvedCountry];
  const stripped = stripCountryPrefix(normalized, rule);
  const matches = rule.formats.some((format) => format.regex.test(stripped));
  if (!matches) {
    return {
      kind: "invalid_format",
      countryCode: resolvedCountry,
      message: buildFormatMessage(rule),
    };
  }

  return {
    kind: "valid",
    countryCode: resolvedCountry,
    normalized: `${resolvedCountry}${stripped}`,
  };
}

export function getCountryDisplayName(code: string | undefined | null): string {
  if (!code) {
    return "selected country";
  }
  const resolved = resolveSupportedTaxCountry(code);
  if (resolved) {
    return TAX_NUMBER_RULES_CONFIG[resolved].displayName;
  }
  const upper = code.toUpperCase();
  return COUNTRY_LABELS[upper as TaxCountryCode] ?? upper;
}
