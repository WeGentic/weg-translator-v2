export type FeatureFlagName = "projectManagerV2";

const flagSources = {
  projectManagerV2: import.meta.env.VITE_FEATURE_PROJECT_MANAGER_V2 === "true",
} satisfies Record<FeatureFlagName, boolean>;

export function getFeatureFlag(flag: FeatureFlagName): boolean {
  return flagSources[flag] ?? false;
}

export function isProjectManagerV2Enabled(): boolean {
  return getFeatureFlag("projectManagerV2");
}
