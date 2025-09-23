/**
 * Identifier prefixes shared by project overview and project editor tabs in the sidebar.
 * Using a literal prefix keeps runtime lookups cheap while preserving precise TypeScript types.
 */
export const PROJECT_VIEW_PREFIX = "project:" as const;
export const EDITOR_VIEW_PREFIX = "editor:" as const;

export type ProjectViewKey = `${typeof PROJECT_VIEW_PREFIX}${string}`;
export type EditorViewKey = `${typeof EDITOR_VIEW_PREFIX}${string}`;

/**
 * Union of all supported content panes for the main workspace area.
 */
export type MainView = "projects" | "settings" | ProjectViewKey | EditorViewKey;

/**
 * Creates a stable sidebar key for a project overview tab.
 */
export function toProjectViewKey(projectId: string): ProjectViewKey {
  return `${PROJECT_VIEW_PREFIX}${projectId}`;
}

/**
 * Extracts the project id from a project overview key. Returns null if parsing fails.
 */
export function parseProjectIdFromKey(key: string): string | null {
  return key.startsWith(PROJECT_VIEW_PREFIX) ? key.slice(PROJECT_VIEW_PREFIX.length) : null;
}

/**
 * Creates a stable sidebar key for a project editor tab.
 */
export function toEditorViewKey(projectId: string): EditorViewKey {
  return `${EDITOR_VIEW_PREFIX}${projectId}`;
}

/**
 * Extracts the project id from a project editor key. Returns null if parsing fails.
 */
export function parseEditorProjectIdFromKey(key: string): string | null {
  return key.startsWith(EDITOR_VIEW_PREFIX) ? key.slice(EDITOR_VIEW_PREFIX.length) : null;
}
