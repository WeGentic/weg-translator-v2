export type FeatureFlagName = "projectManagerV2";

function resolveBooleanFlag(rawValue: string | boolean | undefined, defaultValue: boolean): boolean {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return defaultValue;
}

const flagSources = {
  projectManagerV2: resolveBooleanFlag(import.meta.env.VITE_FEATURE_PROJECT_MANAGER_V2, true),
} satisfies Record<FeatureFlagName, boolean>;

export function getFeatureFlag(flag: FeatureFlagName): boolean {
  return flagSources[flag] ?? false;
}

export function isProjectManagerV2Enabled(): boolean {
  return getFeatureFlag("projectManagerV2");
}
