import { describe, expect, it } from "vitest";

import {
  PASSWORD_POLICY_MIN_LENGTH,
  PASSWORD_RULE_IDS,
  collectUnmetRuleIds,
  evaluatePassword,
  type PasswordRuleId,
} from "@/modules/auth/utils/passwordPolicy";

describe("password policy evaluator", () => {
  it("evaluates each rule and reports unmet requirements", () => {
    const password = "Admin12!";
    const { requirements, allRequirementsMet, strength } = evaluatePassword(password);

    expect(requirements).toHaveLength(PASSWORD_RULE_IDS.length);
    const unmetIds = collectUnmetRuleIds(requirements);
    expect(unmetIds).toContain("minLength");
    expect(unmetIds.includes("uppercase")).toBe(false);
    expect(allRequirementsMet).toBe(false);
    expect(strength.tier).toBe("fair");
  });

  it("caps strength at fair if any rule fails even with high score", () => {
    const password = "SuperiorAdminPass1234";
    const { requirements, strength } = evaluatePassword(password);

    expect(collectUnmetRuleIds(requirements)).toContain("special");
    expect(strength.tier).toBe("fair");
    expect(strength.label).toBe("Fair");
    expect(strength.message.toLowerCase()).toContain("requirements");
  });

  it("returns excellent strength when all rules are satisfied with a long password", () => {
    const password = "Great-Admin-Pass!2024";
    const { requirements, allRequirementsMet, strength } = evaluatePassword(password);

    expect(allRequirementsMet).toBe(true);
    expect(requirements.every((requirement) => requirement.met)).toBe(true);
    expect(strength.tier).toBe("excellent");
    expect(strength.score).toBeGreaterThanOrEqual(85);
    expect(strength.score).toBeLessThanOrEqual(100);
  });

  it("supports extended Unicode characters without throwing", () => {
    const password = "ŁączneHasłoŚĆ" + "9!".repeat(2); // includes uppercase, lowercase, numeric, special
    const { requirements, allRequirementsMet } = evaluatePassword(password);

    const unmetIds: PasswordRuleId[] = collectUnmetRuleIds(requirements);
    expect(unmetIds).toHaveLength(0);
    expect(allRequirementsMet).toBe(true);
  });

  it("scores empty passwords as weak with zero score", () => {
    const { strength, requirements } = evaluatePassword("");

    expect(strength.tier).toBe("weak");
    expect(strength.score).toBe(0);
    expect(collectUnmetRuleIds(requirements)).toEqual(PASSWORD_RULE_IDS);
    const unmetCount = requirements.filter((requirement) => !requirement.met).length;
    expect(unmetCount).toBe(PASSWORD_RULE_IDS.length);
  });

  it("enforces minimum length threshold explicitly", () => {
    const justLongEnough = "Abc!12345678";
    expect(justLongEnough).toHaveLength(PASSWORD_POLICY_MIN_LENGTH);

    const result = evaluatePassword(justLongEnough);
    expect(result.requirements.find((rule) => rule.id === "minLength")?.met).toBe(true);
  });
});

