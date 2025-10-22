import { AsYouType, getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

export const PHONE_COUNTRY_CODES = getCountries();
const COUNTRY_CODE_SET = new Set<string>(PHONE_COUNTRY_CODES);

const DEFAULT_REGION: CountryCode = "US";

export const FALLBACK_PHONE_COUNTRY: CountryCode = PHONE_COUNTRY_CODES.includes(DEFAULT_REGION)
  ? DEFAULT_REGION
  : PHONE_COUNTRY_CODES[0];

function isCountryCode(value: string): value is CountryCode {
  return COUNTRY_CODE_SET.has(value);
}

export interface PhoneCountryMeta {
  readonly code: CountryCode;
  readonly name: string;
  readonly callingCode: string;
  readonly flag: string;
  readonly label: string;
}

export function resolveDefaultCountry(): CountryCode {
  if (typeof navigator !== "undefined" && navigator.language) {
    const segments = navigator.language.split("-");
    const region = segments.length > 1 ? segments[1] : segments[0];
    if (region) {
      const upper = region.toUpperCase();
      if (isCountryCode(upper)) {
        return upper;
      }
    }
  }
  return FALLBACK_PHONE_COUNTRY;
}

export interface EvaluatedPhone {
  readonly raw: string;
  readonly national: string;
  readonly e164: string | null;
  readonly isValid: boolean;
}

export function evaluatePhone(localDigits: string, country: CountryCode): EvaluatedPhone {
  const raw = localDigits.replace(/[^\d]/g, "");
  if (!raw) {
    return { raw: "", national: "", e164: null, isValid: false };
  }

  const formatter = new AsYouType(country);
  formatter.input(raw);
  const number = formatter.getNumber();
  const e164 = formatter.getNumberValue();
  const national = number?.formatNational()?.trim() ?? raw;
  const isValid = Boolean(number?.isValid());

  return {
    raw,
    national,
    e164: isValid && e164 ? e164 : null,
    isValid,
  };
}

export function countryCodeToFlagEmoji(code: CountryCode): string {
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join("");
}

export function getPhoneCountryMeta(code: CountryCode, displayNames: Intl.DisplayNames | null): PhoneCountryMeta {
  const name = displayNames?.of(code) ?? code;
  let callingCode = "";
  try {
    callingCode = getCountryCallingCode(code);
  } catch {
    callingCode = "";
  }
  const flag = countryCodeToFlagEmoji(code);
  const trimmedCalling = callingCode ? `+${callingCode}` : "";
  const label = trimmedCalling ? `${name} (${trimmedCalling})` : name;
  return {
    code,
    name,
    callingCode,
    flag,
    label,
  };
}

export function createPhoneCountryOptions(
  displayNames: Intl.DisplayNames | null,
  locale: string,
): PhoneCountryMeta[] {
  return PHONE_COUNTRY_CODES.map((code) => getPhoneCountryMeta(code, displayNames)).sort((a, b) =>
    a.name.localeCompare(b.name, locale, { sensitivity: "base" }),
  );
}
