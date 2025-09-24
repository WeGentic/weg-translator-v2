import { describe, expect, it } from "vitest";

import {
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_SIDEMENU_COMPACT_WIDTH,
  DEFAULT_SIDEMENU_EXPANDED_WIDTH,
  createLayoutStore,
} from "./layout-store";

describe("layout store", () => {
  it("applies layout config overrides", () => {
    const store = createLayoutStore({
      header: { mounted: true, visible: true, height: 72 },
      footer: { mounted: true, visible: false },
      sidemenu: { mounted: true, mode: "compact", compactWidth: 120 },
    });

    const state = store.getState();

    expect(state.header.mounted).toBe(true);
    expect(state.header.height).toBe(72);
    expect(state.footer.visible).toBe(false);
    expect(state.sidemenu.mode).toBe("compact");
    expect(state.sidemenu.compactWidth).toBe(120);
  });

  it("merges runtime updates for regions", () => {
    const store = createLayoutStore();
    const { setHeader, setSidemenu, cycleSidemenu } = store.getState();

    setHeader({ mounted: true });
    expect(store.getState().header.height).toBe(DEFAULT_HEADER_HEIGHT);

    setHeader({ height: 80, visible: false });
    expect(store.getState().header.height).toBe(80);
    expect(store.getState().header.visible).toBe(false);

    setSidemenu({ mounted: true, mode: "expanded" });
    expect(store.getState().sidemenu.mode).toBe("expanded");
    expect(store.getState().sidemenu.expandedWidth).toBe(DEFAULT_SIDEMENU_EXPANDED_WIDTH);

    setSidemenu({ mode: "compact", compactWidth: 96 });
    expect(store.getState().sidemenu.mode).toBe("compact");
    expect(store.getState().sidemenu.compactWidth).toBe(96);

    setSidemenu({ mode: "hidden" });
    expect(store.getState().sidemenu.mode).toBe("hidden");

    cycleSidemenu();
    expect(store.getState().sidemenu.mode).toBe("expanded");
  });

  it("resets to defaults", () => {
    const store = createLayoutStore({
      header: { mounted: true, height: 70 },
      sidemenu: { mounted: true, mode: "compact", compactWidth: 100 },
    });

    store.getState().setHeaderContent(<div>header</div>);
    store.getState().setFooterContent(<div>footer</div>);
    store.getState().setSidemenuContent(<div>sidemenu</div>);

    store.getState().reset();

    const state = store.getState();

    expect(state.header.mounted).toBe(false);
    expect(state.header.height).toBe(DEFAULT_HEADER_HEIGHT);
    expect(state.sidemenu.mode).toBe("unmounted");
    expect(state.sidemenu.compactWidth).toBe(DEFAULT_SIDEMENU_COMPACT_WIDTH);
    expect(state.headerContent).toBeNull();
    expect(state.footerContent).toBeNull();
    expect(state.sidemenuContent).toBeNull();
  });
});
