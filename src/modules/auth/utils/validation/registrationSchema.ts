import { z } from "zod";
import { isValidPhoneNumber } from "react-phone-number-input";
import validator from "validator";

import {
  COMPANY_NAME_MAX_LENGTH,
  REGISTRATION_FIELD_KEYS,
  type RegistrationField,
} from "@/modules/auth/utils/constants/registration";
import {
  getCountryDisplayName,
  TAX_NUMBER_UNSUPPORTED_MESSAGE,
  validateTaxNumberFormat,
} from "@/modules/auth/utils/validation/tax-number-rules";
import { evaluatePassword } from "@/modules/auth/utils/passwordPolicy";

type CompanyFieldKey =
  | "companyName"
  | "companyAddress"
  | "companyEmail"
  | "companyPhone"
  | "companyTaxNumber";
type AdminFieldKey = "adminEmail" | "adminPassword" | "adminPasswordConfirm";

export type RegistrationFormValues = Record<RegistrationField, string>;
export type RegistrationFormErrors = Record<RegistrationField, string>;

export interface RegistrationSchemaOptions {
  /**
   * ISO 3166-1 alpha-2 code inferred from the address. Legacy VAT prefixes are resolved automatically.
   */
  taxCountryCode?: string | null;
  /**
   * E.164 phone value provided by the phone input. When omitted, validation falls back to the raw field value.
   */
  phoneValue?: string;
  /**
   * Tracks whether any dial digits have been entered. Mirrors the existing imperative logic that inspects the domestic dial code input.
   */
  hasPhoneDigits?: boolean;
}

const REQUIRED_MESSAGES: Record<RegistrationField, string> = {
  companyName: "Company name is required.",
  companyAddress: "Company address is required.",
  companyEmail: "Company email is required.",
  companyPhone: "Company phone is required.",
  companyTaxNumber: "Company tax number is required.",
  adminEmail: "Admin email is required.",
  adminPassword: "Admin password is required.",
  adminPasswordConfirm: "Please confirm the admin password.",
};

export const EMAIL_INVALID_MESSAGE = "Enter a valid email address.";
export const PHONE_INVALID_MESSAGE = "Enter a valid phone number for the selected country.";
export const PASSWORD_MISMATCH_MESSAGE = "Passwords must match.";

const COMPANY_NAME_LENGTH_MESSAGE = `Company name cannot exceed ${COMPANY_NAME_MAX_LENGTH} characters.`;

type CompanyValues = Pick<RegistrationFormValues, CompanyFieldKey>;
type AdminValues = Pick<RegistrationFormValues, AdminFieldKey>;

function addIssue(
  ctx: z.RefinementCtx,
  field: RegistrationField,
  message: string,
): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [field],
    message,
  });
}

function ensureRequired(
  ctx: z.RefinementCtx,
  field: RegistrationField,
  rawValue: string,
): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed.length) {
    addIssue(ctx, field, REQUIRED_MESSAGES[field]);
    return null;
  }
  return trimmed;
}

function runCompanyChecks(
  values: CompanyValues,
  ctx: z.RefinementCtx,
  options: RegistrationSchemaOptions,
): void {
  const name = ensureRequired(ctx, "companyName", values.companyName);
  if (name && Array.from(name).length > COMPANY_NAME_MAX_LENGTH) {
    addIssue(ctx, "companyName", COMPANY_NAME_LENGTH_MESSAGE);
  }

  ensureRequired(ctx, "companyAddress", values.companyAddress);

  const companyEmail = ensureRequired(ctx, "companyEmail", values.companyEmail);
  if (
    companyEmail &&
    !validator.isEmail(companyEmail, {
      allow_utf8_local_part: true,
      ignore_max_length: false,
    })
  ) {
    addIssue(ctx, "companyEmail", EMAIL_INVALID_MESSAGE);
  }

  const resolvedPhoneValue =
    options.phoneValue ??
    (values.companyPhone.trim().length ? values.companyPhone : undefined);
  const digitsCount = values.companyPhone.replace(/\D/g, "").length;
  const hasDigits =
    options.hasPhoneDigits ?? (digitsCount > 0 || Boolean(resolvedPhoneValue));

  if (!hasDigits) {
    addIssue(ctx, "companyPhone", REQUIRED_MESSAGES.companyPhone);
  } else if (!resolvedPhoneValue || !isValidPhoneNumber(resolvedPhoneValue)) {
    addIssue(ctx, "companyPhone", PHONE_INVALID_MESSAGE);
  }

  const taxNumber = ensureRequired(ctx, "companyTaxNumber", values.companyTaxNumber);
  if (taxNumber) {
    const taxResult = validateTaxNumberFormat({
      value: taxNumber,
      countryCode: options.taxCountryCode,
    });
    if (taxResult.kind === "invalid_format") {
      addIssue(ctx, "companyTaxNumber", taxResult.message);
    } else if (taxResult.kind === "unsupported") {
      const targetName = getCountryDisplayName(options.taxCountryCode);
      const message =
        options.taxCountryCode && targetName !== "selected country"
          ? `Tax number validation is not available for ${targetName} yet. Please double-check the identifier.`
          : TAX_NUMBER_UNSUPPORTED_MESSAGE;
      addIssue(ctx, "companyTaxNumber", message);
    }
  }
}

function runAdminChecks(values: AdminValues, ctx: z.RefinementCtx): void {
  const adminEmail = ensureRequired(ctx, "adminEmail", values.adminEmail);
  if (
    adminEmail &&
    !validator.isEmail(adminEmail, {
      allow_utf8_local_part: true,
      ignore_max_length: false,
    })
  ) {
    addIssue(ctx, "adminEmail", EMAIL_INVALID_MESSAGE);
  }

  const adminPassword = ensureRequired(ctx, "adminPassword", values.adminPassword);
  const adminPasswordConfirm = ensureRequired(
    ctx,
    "adminPasswordConfirm",
    values.adminPasswordConfirm,
  );

  if (
    adminPassword &&
    adminPasswordConfirm &&
    values.adminPassword !== values.adminPasswordConfirm
  ) {
    addIssue(ctx, "adminPasswordConfirm", PASSWORD_MISMATCH_MESSAGE);
  }

  if (adminPassword) {
    const evaluation = evaluatePassword(values.adminPassword);
    if (!evaluation.allRequirementsMet) {
      const unmet = evaluation.requirements.filter((requirement) => !requirement.met);
      if (unmet.length === 1) {
        addIssue(ctx, "adminPassword", unmet[0]?.failureMessage ?? REQUIRED_MESSAGES.adminPassword);
      } else if (unmet.length > 1) {
        const summary = unmet.map((requirement) => requirement.failureMessage).join("; ");
        addIssue(
          ctx,
          "adminPassword",
          `Password requirements not satisfied: ${summary}`,
        );
      }
    }
  }
}

export function createCompanySchema(options: RegistrationSchemaOptions = {}) {
  const schema = z.object({
    companyName: z.string(),
    companyAddress: z.string(),
    companyEmail: z.string(),
    companyPhone: z.string(),
    companyTaxNumber: z.string(),
  });

  return schema.superRefine((values, ctx) => {
    runCompanyChecks(values, ctx, options);
  });
}

export function createAdminSchema() {
  const schema = z.object({
    adminEmail: z.string(),
    adminPassword: z.string(),
    adminPasswordConfirm: z.string(),
  });

  return schema.superRefine((values, ctx) => {
    runAdminChecks(values, ctx);
  });
}

export function createRegistrationSchema(options: RegistrationSchemaOptions = {}) {
  const schema = z.object({
    companyName: z.string(),
    companyAddress: z.string(),
    companyEmail: z.string(),
    companyPhone: z.string(),
    companyTaxNumber: z.string(),
    adminEmail: z.string(),
    adminPassword: z.string(),
    adminPasswordConfirm: z.string(),
  });

  return schema.superRefine((values, ctx) => {
    runCompanyChecks(values, ctx, options);
    runAdminChecks(values, ctx);

    // Validate company_email matches admin_email for new schema requirement
    const companyEmail = values.companyEmail.trim().toLowerCase();
    const adminEmail = values.adminEmail.trim().toLowerCase();

    if (companyEmail && adminEmail && companyEmail !== adminEmail) {
      addIssue(
        ctx,
        "companyEmail",
        "Company email must match your admin email"
      );
    }
  });
}

export function createEmptyRegistrationErrors(): RegistrationFormErrors {
  return REGISTRATION_FIELD_KEYS.reduce<RegistrationFormErrors>((acc, field) => {
    acc[field] = "";
    return acc;
  }, {} as RegistrationFormErrors);
}

export function collectRegistrationErrors(
  values: RegistrationFormValues,
  options: RegistrationSchemaOptions = {},
): RegistrationFormErrors {
  const schema = createRegistrationSchema(options);
  const validation = schema.safeParse(values);
  if (validation.success) {
    return createEmptyRegistrationErrors();
  }

  const nextErrors = createEmptyRegistrationErrors();
  for (const issue of validation.error.issues) {
    const [field] = issue.path;
    const knownField =
      typeof field === "string" &&
      (REGISTRATION_FIELD_KEYS as readonly string[]).includes(field);
    if (!knownField) {
      continue;
    }
    const key = field as RegistrationField;
    if (!nextErrors[key]) {
      nextErrors[key] = issue.message;
    }
  }
  return nextErrors;
}
