/**
 * Registration validation helpers keep business rules pure and reusable across hooks/components.
 * This module now delegates to the Zod-powered schemas while preserving the public API expected
 * by the rest of the auth module.
 */

import {
  collectRegistrationErrors,
  createEmptyRegistrationErrors as schemaCreateEmptyErrors,
  type RegistrationFormErrors,
  type RegistrationFormValues,
  type RegistrationSchemaOptions,
} from "@/modules/auth/utils/validation/registrationSchema";
import { REGISTRATION_FIELDS, type RegistrationField } from "@/modules/auth/utils/constants/registration";

export type RegistrationValidationOptions = RegistrationSchemaOptions;
export type RegistrationValues = RegistrationFormValues;
export type RegistrationErrors = RegistrationFormErrors;
export type RegistrationTouched = Record<RegistrationField, boolean>;

const EMPTY_VALUES_TEMPLATE: RegistrationValues = {
  companyName: "",
  companyAddress: "",
  companyEmail: "",
  companyPhone: "",
  companyTaxNumber: "",
  adminEmail: "",
  adminPassword: "",
  adminPasswordConfirm: "",
};

const UNTOUCHED_TEMPLATE: RegistrationTouched = REGISTRATION_FIELDS.reduce(
  (acc, field) => {
    acc[field] = false;
    return acc;
  },
  {} as RegistrationTouched,
);

const ALL_TOUCHED_TEMPLATE: RegistrationTouched = REGISTRATION_FIELDS.reduce(
  (acc, field) => {
    acc[field] = true;
    return acc;
  },
  {} as RegistrationTouched,
);

export function createEmptyRegistrationValues(): RegistrationValues {
  return { ...EMPTY_VALUES_TEMPLATE };
}

export function createEmptyRegistrationErrors(): RegistrationErrors {
  return schemaCreateEmptyErrors();
}

export function createUntouchedRegistrationTouched(): RegistrationTouched {
  return { ...UNTOUCHED_TEMPLATE };
}

export function createAllTouchedRegistrationTouched(): RegistrationTouched {
  return { ...ALL_TOUCHED_TEMPLATE };
}

export function validateRegistrationValues(
  values: RegistrationValues,
  options: RegistrationValidationOptions = {},
): RegistrationErrors {
  return collectRegistrationErrors(values, options);
}

export function createInitialRegistrationErrors(): RegistrationErrors {
  return collectRegistrationErrors(createEmptyRegistrationValues(), {
    hasPhoneDigits: false,
  });
}

export {
  EMAIL_INVALID_MESSAGE,
  PHONE_INVALID_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/modules/auth/utils/validation/registrationSchema";

export {
  normalizeTaxNumber,
  validateTaxNumberFormat,
} from "@/modules/auth/utils/validation/tax-number-rules";

export type { TaxNumberValidationResult } from "@/modules/auth/utils/validation/tax-number-rules";

// Legacy exports kept for backward compatibility with modules that still import
// the previous VAT-related message constants. They are no longer used by the
// updated registration flow but remain defined to avoid runtime import errors.
export const VAT_LOOKUP_FAIL_MESSAGE = "VAT validation service is unavailable. Try again later.";
export const VAT_NOT_FOUND_MESSAGE = "VAT number not found in the VIES registry.";
