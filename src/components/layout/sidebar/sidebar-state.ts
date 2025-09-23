/**
 * Sidebar view-state values supported across the application layout.
 * The literal union is shared so that header, sidebar, and the root App all stay in sync.
 */
export type SidebarState = "expanded" | "compact" | "hidden";

const SIDEBAR_SEQUENCE: SidebarState[] = ["expanded", "compact", "hidden"];

/**
 * Returns the next sidebar state in the cycle (expanded → compact → hidden → expanded).
 */
export function getNextSidebarState(current: SidebarState): SidebarState {
  const index = SIDEBAR_SEQUENCE.indexOf(current);
  if (index === -1) {
    return "expanded";
  }
  return SIDEBAR_SEQUENCE[(index + 1) % SIDEBAR_SEQUENCE.length];
}
