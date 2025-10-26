/**
 * Shared password policy utilities consumed by validation schemas and UI layers.
 * Rules follow OWASP Authentication Cheat Sheet guidance:
 * https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 */

const UNICODE_LETTER = /\p{L}/u;
const UNICODE_UPPER = /\p{Lu}/u;
const UNICODE_LOWER = /\p{Ll}/u;
const UNICODE_NUMBER = /\p{N}/u;
const UNICODE_SPECIAL = /[^\p{L}\p{N}\s]/u;

export const PASSWORD_POLICY_MIN_LENGTH = 12;
export const PASSWORD_POLICY_MAX_SCORE = 100;
const LENGTH_TARGET = 20;
const LENGTH_WEIGHT = 60;
const VARIETY_WEIGHT = PASSWORD_POLICY_MAX_SCORE - LENGTH_WEIGHT;

export const PASSWORD_RULE_IDS = [
  "minLength",
  "uppercase",
  "lowercase",
  "numeric",
  "special",
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULE_IDS)[number];

export interface PasswordRuleDefinition {
  id: PasswordRuleId;
  label: string;
  description: string;
  failureMessage: string;
  /**
   * Determines whether the supplied password satisfies the rule.
   */
  test: (password: string) => boolean;
}

export interface PasswordRequirementStatus {
  id: PasswordRuleId;
  label: string;
  description: string;
  failureMessage: string;
  met: boolean;
}

export const PASSWORD_RULES: readonly PasswordRuleDefinition[] = [
  {
    id: "minLength",
    label: "At least 12 characters",
    description: "Use a minimum of 12 Unicode characters to resist brute-force attacks.",
    failureMessage: "Password must be at least 12 characters long.",
    test: (password) => countCodepoints(password) >= PASSWORD_POLICY_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "Includes an uppercase letter",
    description: "Add at least one uppercase letter to increase character variety.",
    failureMessage: "Password must include at least one uppercase letter.",
    test: (password) => UNICODE_UPPER.test(password),
  },
  {
    id: "lowercase",
    label: "Includes a lowercase letter",
    description: "Include a lowercase letter to keep the password readable.",
    failureMessage: "Password must include at least one lowercase letter.",
    test: (password) => UNICODE_LOWER.test(password),
  },
  {
    id: "numeric",
    label: "Includes a number",
    description: "Mix in a digit to expand beyond alphabetic characters.",
    failureMessage: "Password must include at least one number.",
    test: (password) => UNICODE_NUMBER.test(password),
  },
  {
    id: "special",
    label: "Includes a symbol",
    description: "Use a symbol to introduce non-alphanumeric characters.",
    failureMessage: "Password must include at least one symbol.",
    test: (password) => UNICODE_SPECIAL.test(password),
  },
] as const;

export const PASSWORD_STRENGTH_TIERS = ["weak", "fair", "strong", "excellent"] as const;

export type PasswordStrengthTier = (typeof PASSWORD_STRENGTH_TIERS)[number];

interface StrengthThreshold {
  tier: PasswordStrengthTier;
  label: string;
  minScore: number;
  message: string;
  unmetMessage?: string;
}

const STRENGTH_THRESHOLDS: readonly StrengthThreshold[] = [
  {
    tier: "excellent",
    label: "Excellent",
    minScore: 85,
    message: "Excellent password. Keep it stored securely.",
  },
  {
    tier: "strong",
    label: "Strong",
    minScore: 65,
    message: "Strong password. Consider a passphrase for even more resilience.",
  },
  {
    tier: "fair",
    label: "Fair",
    minScore: 35,
    message: "Meets most expectations. Add length or variety to strengthen it.",
    unmetMessage: "Complete the remaining requirements to unlock a stronger rating.",
  },
  {
    tier: "weak",
    label: "Weak",
    minScore: 0,
    message: "Add more characters and mix in uppercase, lowercase, numbers, and symbols.",
  },
] as const;

export interface PasswordStrengthResult {
  tier: PasswordStrengthTier;
  score: number;
  label: string;
  message: string;
}

export interface PasswordEvaluationResult {
  requirements: PasswordRequirementStatus[];
  allRequirementsMet: boolean;
  strength: PasswordStrengthResult;
}

export function evaluatePassword(password: string): PasswordEvaluationResult {
  const candidate = password ?? "";
  const requirements = PASSWORD_RULES.map<PasswordRequirementStatus>((rule) => ({
    id: rule.id,
    label: rule.label,
    description: rule.description,
    failureMessage: rule.failureMessage,
    met: rule.test(candidate),
  }));

  const allRequirementsMet = requirements.every((requirement) => requirement.met);
  const score = computePasswordScore(candidate, requirements);
  const strength = resolveStrength(score, allRequirementsMet);

  return {
    requirements,
    allRequirementsMet,
    strength,
  };
}

export function collectUnmetRuleIds(
  requirements: PasswordRequirementStatus[],
): PasswordRuleId[] {
  return requirements.filter((requirement) => !requirement.met).map((requirement) => requirement.id);
}

function computePasswordScore(
  password: string,
  requirements: PasswordRequirementStatus[],
): number {
  if (!password.length) {
    return 0;
  }

  const lengthScore = Math.min(countCodepoints(password), LENGTH_TARGET) / LENGTH_TARGET;
  const classCount = countCharacterClasses(password);
  const varietyScore = classCount / PASSWORD_RULE_IDS.length;
  const unmetPenalty = requirements.filter(({ met }) => !met).length * 0.05;

  const rawScore =
    lengthScore * LENGTH_WEIGHT +
    Math.min(Math.max(varietyScore - unmetPenalty, 0), 1) * VARIETY_WEIGHT;

  return Math.round(Math.max(0, Math.min(PASSWORD_POLICY_MAX_SCORE, rawScore)));
}

function resolveStrength(score: number, allRequirementsMet: boolean): PasswordStrengthResult {
  const definition =
    STRENGTH_THRESHOLDS.find((threshold) => score >= threshold.minScore) ??
    STRENGTH_THRESHOLDS[STRENGTH_THRESHOLDS.length - 1];

  if (!allRequirementsMet && (definition.tier === "excellent" || definition.tier === "strong")) {
    const fairDefinition = STRENGTH_THRESHOLDS.find((threshold) => threshold.tier === "fair");
    if (!fairDefinition) {
      return {
        tier: definition.tier,
        score,
        label: definition.label,
        message: definition.message,
      };
    }
    return {
      tier: fairDefinition.tier,
      score,
      label: fairDefinition.label,
      message: fairDefinition.unmetMessage ?? fairDefinition.message,
    };
  }

  const message =
    !allRequirementsMet && definition.unmetMessage ? definition.unmetMessage : definition.message;

  return {
    tier: definition.tier,
    score,
    label: definition.label,
    message,
  };
}

function countCodepoints(value: string): number {
  return Array.from(value).length;
}

function countCharacterClasses(value: string): number {
  let classes = 0;
  if (UNICODE_LOWER.test(value)) {
    classes += 1;
  }
  if (UNICODE_UPPER.test(value)) {
    classes += 1;
  }
  if (UNICODE_NUMBER.test(value)) {
    classes += 1;
  }
  if (UNICODE_SPECIAL.test(value)) {
    classes += 1;
  }
  if (UNICODE_LETTER.test(value) && !UNICODE_LOWER.test(value) && !UNICODE_UPPER.test(value)) {
    classes += 1;
  }
  return classes;
}
