/**
 * Registration field metadata and step configuration shared across the auth module.
 * Centralizing these values keeps the multi-step wizard consistent as logic and views evolve.
 */

import type { HTMLInputTypeAttribute, InputHTMLAttributes } from "react";

export const REGISTRATION_FIELD_KEYS = [
  "companyName",
  "companyAddress",
  "companyEmail",
  "companyPhone",
  "companyTaxNumber",
  "adminEmail",
  "adminPassword",
  "adminPasswordConfirm",
] as const;

export type RegistrationField = (typeof REGISTRATION_FIELD_KEYS)[number];

export interface RegistrationFieldConfig {
  key: RegistrationField;
  id: string;
  label: string;
  name: string;
  placeholder: string;
  type: HTMLInputTypeAttribute;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}

export const COMPANY_NAME_MAX_LENGTH = 50;

export const COMPANY_FIELDS: readonly RegistrationFieldConfig[] = [
  {
    key: "companyName",
    id: "company-name",
    label: "Company name",
    name: "companyName",
    placeholder: "Acme Translation Ltd.",
    type: "text",
    autoComplete: "organization",
    maxLength: COMPANY_NAME_MAX_LENGTH,
  },
  {
    key: "companyAddress",
    id: "company-address",
    label: "Company address",
    name: "companyAddress",
    placeholder: "123 Localization Ave, Suite 400",
    type: "text",
    autoComplete: "street-address",
  },
  {
    key: "companyEmail",
    id: "company-email",
    label: "Company email",
    name: "companyEmail",
    placeholder: "contact@acmetraductions.com",
    type: "email",
    autoComplete: "email",
  },
  {
    key: "companyPhone",
    id: "company-phone",
    label: "Company phone",
    name: "companyPhone",
    placeholder: "+1 555 012 3456",
    type: "tel",
    autoComplete: "tel",
    inputMode: "tel",
  },
  {
    key: "companyTaxNumber",
    id: "company-tax-number",
    label: "Company tax number",
    name: "companyTaxNumber",
    placeholder: "VAT / Tax ID",
    type: "text",
    autoComplete: "off",
  },
] as const;

export const ADMIN_FIELDS: readonly RegistrationFieldConfig[] = [
  {
    key: "adminEmail",
    id: "admin-email",
    label: "Admin email",
    name: "adminEmail",
    placeholder: "admin@acmetraductions.com",
    type: "email",
    autoComplete: "email",
  },
  {
    key: "adminPassword",
    id: "admin-password",
    label: "Password",
    name: "adminPassword",
    placeholder: "Create a password",
    type: "password",
    autoComplete: "new-password",
  },
  {
    key: "adminPasswordConfirm",
    id: "admin-password-confirm",
    label: "Confirm password",
    name: "adminPasswordConfirm",
    placeholder: "Re-enter password",
    type: "password",
    autoComplete: "new-password",
  },
] as const;

export const ALL_FIELD_CONFIGS = [...COMPANY_FIELDS, ...ADMIN_FIELDS] as const;

export const FIELD_CONFIG_BY_KEY = ALL_FIELD_CONFIGS.reduce<Record<RegistrationField, RegistrationFieldConfig>>(
  (acc, field) => {
    acc[field.key] = field;
    return acc;
  },
  {} as Record<RegistrationField, RegistrationFieldConfig>,
);

export const REGISTRATION_FIELDS = [...REGISTRATION_FIELD_KEYS] as readonly RegistrationField[];

export const COMPANY_FIELD_ROWS: readonly (readonly RegistrationField[])[] = [
  ["companyName", "companyEmail"],
  ["companyAddress"],
  ["companyTaxNumber", "companyPhone"],
] as const;

export const ADMIN_FIELD_ROWS: readonly (readonly RegistrationField[])[] = [
  ["adminEmail"],
  ["adminPassword", "adminPasswordConfirm"],
] as const;

export const STEP_SEQUENCE = ["company", "admin"] as const;
export type RegistrationStepKey = (typeof STEP_SEQUENCE)[number];

export const STEP_LABELS: Record<RegistrationStepKey, string> = {
  company: "Company details",
  admin: "Admin account",
};

export const STEP_FIELDS: Record<RegistrationStepKey, RegistrationField[]> = {
  company: COMPANY_FIELD_ROWS.flat(),
  admin: ADMIN_FIELD_ROWS.flat(),
};
