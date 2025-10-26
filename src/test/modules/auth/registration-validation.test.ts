import { describe, expect, it } from "vitest";

import {
  createEmptyRegistrationValues,
  normalizeTaxNumber,
  validateRegistrationValues,
  validateTaxNumberFormat,
} from "@/modules/auth/utils/validation/registration";
import { COMPANY_FIELD_ROWS } from "@/modules/auth/utils/constants/registration";

describe("registration validation utilities", () => {
  it("normalizes tax numbers by stripping punctuation and uppercasing letters", () => {
    expect(normalizeTaxNumber("de 136-695-976")).toBe("DE136695976");
  });

  it("flags required fields when values are empty", () => {
    const values = createEmptyRegistrationValues();
    const errors = validateRegistrationValues(values);

    expect(errors.companyName).toBe("Company name is required.");
    expect(errors.companyTaxNumber).toBe("Company tax number is required.");
    expect(errors.adminPasswordConfirm).toBe("Please confirm the admin password.");
  });

  it("accepts valid payloads for company and admin details", () => {
    const values = createEmptyRegistrationValues();
    values.companyName = "Acme Localization GmbH";
    values.companyAddress = "Unter den Linden 1, Berlin";
    values.companyEmail = "team@acme.test";
    values.companyPhone = "+49301234567";
    values.companyTaxNumber = "DE136695976";
    values.adminEmail = "owner@acme.test";
    values.adminPassword = "S3curePass!42";
    values.adminPasswordConfirm = "S3curePass!42";

    const errors = validateRegistrationValues(values, {
      phoneValue: values.companyPhone,
      hasPhoneDigits: true,
      taxCountryCode: "DE",
    });

    expect(Object.values(errors).every((message) => message === "")).toBe(true);
  });

  it("detects invalid tax numbers for the inferred country", () => {
    const result = validateTaxNumberFormat({ value: "12", countryCode: "DE" });
    expect(result).toMatchObject({ kind: "invalid_format" });
  });

  it("surfaces granular password error message when multiple requirements fail", () => {
    const values = createEmptyRegistrationValues();
    values.companyName = "Acme Localization GmbH";
    values.companyAddress = "Unter den Linden 1, Berlin";
    values.companyEmail = "team@acme.test";
    values.companyPhone = "+49301234567";
    values.companyTaxNumber = "DE136695976";
    values.adminEmail = "owner@acme.test";
    values.adminPassword = "shortpass";
    values.adminPasswordConfirm = "shortpass";

    const errors = validateRegistrationValues(values, {
      phoneValue: values.companyPhone,
      hasPhoneDigits: true,
      taxCountryCode: "DE",
    });

    expect(errors.adminPassword).toContain("Password requirements not satisfied");
    expect(errors.adminPassword).toContain("uppercase");
    expect(errors.adminPassword).toContain("symbol");
  });

  it("returns a single rule failure message when only one requirement is unmet", () => {
    const values = createEmptyRegistrationValues();
    values.companyName = "Acme Localization GmbH";
    values.companyAddress = "Unter den Linden 1, Berlin";
    values.companyEmail = "team@acme.test";
    values.companyPhone = "+49301234567";
    values.companyTaxNumber = "DE136695976";
    values.adminEmail = "owner@acme.test";
    values.adminPassword = "SecureAdmin1234";
    values.adminPasswordConfirm = "SecureAdmin1234";

    const errors = validateRegistrationValues(values, {
      phoneValue: values.companyPhone,
      hasPhoneDigits: true,
      taxCountryCode: "DE",
    });

    expect(errors.adminPassword).toBe("Password must include at least one symbol.");
  });

  it("ensures company email precedes tax number in layout metadata", () => {
    const order = COMPANY_FIELD_ROWS.flat();
    expect(order.indexOf("companyEmail")).toBeGreaterThan(-1);
    expect(order.indexOf("companyTaxNumber")).toBeGreaterThan(-1);
    expect(order.indexOf("companyEmail")).toBeLessThan(order.indexOf("companyTaxNumber"));
  });
});
