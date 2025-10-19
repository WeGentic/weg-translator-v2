import { checkVAT, countries as vatCountries } from "jsvat";
import validator from "validator";

export interface ClientFormErrors {
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly vatNumber?: string;
}

export const MAX_CLIENT_NAME_LENGTH = 50;

function isAllUpperCase(value: string): boolean {
  const alpha = value.replace(/[^\p{L}]+/gu, "");
  return alpha.length > 0 && alpha === alpha.toUpperCase() && alpha !== alpha.toLowerCase();
}

export function validateClientName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Client name is required.";
  }
  if (Array.from(trimmed).length > MAX_CLIENT_NAME_LENGTH) {
    return `Client name cannot exceed ${MAX_CLIENT_NAME_LENGTH} characters.`;
  }
  if (isAllUpperCase(trimmed)) {
    return "Client name cannot be written in all uppercase.";
  }
  return undefined;
}

export function validateEmail(value: string): { normalized: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { normalized: "" };
  }
  const valid = validator.isEmail(trimmed, {
    allow_utf8_local_part: true,
    ignore_max_length: false,
  });
  if (!valid) {
    return {
      normalized: trimmed,
      error: "Enter a valid email address.",
    };
  }
  return { normalized: trimmed.toLowerCase() };
}

export function sanitizeVat(value: string): { normalized: string; error?: string } {
  const compact = value.replace(/[\s-]+/g, "").toUpperCase();
  if (!compact) {
    return { normalized: "" };
  }
  const result = checkVAT(compact, vatCountries);
  if (!result.isSupportedCountry) {
    return { normalized: compact, error: "Unsupported VAT country code." };
  }
  if (!result.isValidFormat) {
    return {
      normalized: compact,
      error: "VAT number format is invalid. Include the country prefix.",
    };
  }
  if (!result.isValid) {
    return {
      normalized: compact,
      error: "VAT number checksum is invalid.",
    };
  }
  return { normalized: result.value ?? compact };
}

export function hasFieldErrors(errors: ClientFormErrors): boolean {
  return Boolean(errors.name || errors.email || errors.phone || errors.vatNumber);
}
