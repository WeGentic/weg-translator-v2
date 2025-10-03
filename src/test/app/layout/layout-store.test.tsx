import { describe, expect, it } from "vitest";

import {
  DEFAULT_FOOTER_HEIGHT,
  DEFAULT_HEADER_HEIGHT,
  createLayoutStore,
} from "@/app/layout/layout-store";

describe("layout store", () => {
  it("applies layout config overrides", () => {
    const store = createLayoutStore({
      header: { mounted: true, visible: true, height: 72 },
      footer: { mounted: true, visible: false, height: 40 },
      sidebarOne: { mounted: true, width: 72 },
      sidebarTwo: { mounted: true, visible: false, width: 168 },
    });

    const state = store.getState();

    expect(state.header.height).toBe(72);
    expect(state.header.mounted).toBe(true);
    expect(state.footer.visible).toBe(false);
    expect(state.footer.height).toBe(40);
    expect(state.sidebarOne.mounted).toBe(true);
    expect(state.sidebarOne.width).toBe(72);
    expect(state.sidebarTwo.visible).toBe(false);
    expect(state.sidebarTwo.width).toBe(168);
  });

  it("merges runtime updates for layout regions", () => {
    const store = createLayoutStore();

    store.getState().setHeader({ mounted: true });
    store.getState().setHeader({ height: 80, visible: false });
    expect(store.getState().header.height).toBe(80);
    expect(store.getState().header.visible).toBe(false);

    store.getState().setFooter({ mounted: true, height: 60 });
    expect(store.getState().footer.height).toBe(60);

    store.getState().setSidebarOne({ mounted: true, width: 88 });
    expect(store.getState().sidebarOne.width).toBe(88);

    store.getState().setSidebarTwo({ mounted: true, visible: true, width: 208 });
    expect(store.getState().sidebarTwo.visible).toBe(true);
    expect(store.getState().sidebarTwo.width).toBe(208);

    store.getState().setSidebarTwo({ visible: false });
    expect(store.getState().sidebarTwo.visible).toBe(false);

    store.getState().setHeaderContent(<div>header</div>);
    expect(store.getState().headerContent).not.toBeNull();

    store.getState().setSidebarTwoContent(<div>secondary</div>);
    expect(store.getState().sidebarTwoContent).not.toBeNull();
  });

  it("resets to defaults", () => {
    const store = createLayoutStore({
      header: { mounted: true, height: 70 },
      footer: { mounted: true, height: 48 },
      sidebarTwo: { mounted: true, visible: false },
    });

    store.getState().setHeaderContent(<div>header</div>);
    store.getState().setFooterContent(<div>footer</div>);
    store.getState().setSidebarOneContent(<div>primary</div>);
    store.getState().setSidebarTwoContent(<div>secondary</div>);

    store.getState().reset();

    const state = store.getState();

    expect(state.header.mounted).toBe(false);
    expect(state.header.height).toBe(DEFAULT_HEADER_HEIGHT);
    expect(state.footer.height).toBe(DEFAULT_FOOTER_HEIGHT);
    expect(state.sidebarTwo.visible).toBe(true);
    expect(state.headerContent).toBeNull();
    expect(state.footerContent).toBeNull();
    expect(state.sidebarOneContent).toBeNull();
    expect(state.sidebarTwoContent).toBeNull();
  });
});
