export const DEFAULT_SIDEMENU_EXPANDED_WIDTH = 256;
export const DEFAULT_SIDEMENU_COMPACT_WIDTH = 64;

export type SidemenuState =
  | { kind: "expanded"; width: number; pinned?: boolean }
  | { kind: "compact"; width: number }
  | { kind: "hidden" };

export function isExpanded(state: SidemenuState): state is Extract<SidemenuState, { kind: "expanded" }> {
  return state.kind === "expanded";
}

export function isCompact(state: SidemenuState): state is Extract<SidemenuState, { kind: "compact" }> {
  return state.kind === "compact";
}

export function isHidden(state: SidemenuState): state is Extract<SidemenuState, { kind: "hidden" }> {
  return state.kind === "hidden";
}

export function cycleSidemenu(state: SidemenuState): SidemenuState {
  switch (state.kind) {
    case "expanded":
      return { kind: "compact", width: DEFAULT_SIDEMENU_COMPACT_WIDTH };
    case "compact":
      return { kind: "hidden" };
    case "hidden":
    default:
      return { kind: "expanded", width: DEFAULT_SIDEMENU_EXPANDED_WIDTH };
  }
}

export function sidemenuEquals(a: SidemenuState, b: SidemenuState): boolean {
  if (a.kind !== b.kind) {
    return false;
  }

  if (a.kind === "hidden") {
    return true;
  }

  if (a.kind === "expanded") {
    if (b.kind !== "expanded") {
      return false;
    }
    return a.width === b.width && a.pinned === b.pinned;
  }

  if (b.kind !== "compact") {
    return false;
  }

  return a.width === b.width;
}
