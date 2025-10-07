import { render, screen } from "@testing-library/react";

import { PanelContent, PanelHeader, PanelToolbar, ThreeZonePanel } from "./ThreeZonePanel";

describe("ThreeZonePanel", () => {
  it("renders all slots when provided via props", () => {
    render(
      <ThreeZonePanel
        header={<div>Header Content</div>}
        toolbar={<div>Toolbar Content</div>}
        footer={<div>Footer Content</div>}
      >
        <div>Body Content</div>
      </ThreeZonePanel>,
    );

    const headerElement = screen.getByText("Header Content").closest("header");
    expect(headerElement).not.toBeNull();
    const resolvedHeader = headerElement as HTMLElement;
    expect(resolvedHeader.getAttribute("data-slot")).toBe("header");

    const toolbar = screen.getByRole("toolbar");
    expect(toolbar.textContent).toContain("Toolbar Content");
    expect(toolbar.getAttribute("data-slot")).toBe("toolbar");

    expect(screen.queryByText("Body Content")).not.toBeNull();
    expect(screen.queryByText("Footer Content")).not.toBeNull();
  });

  it("extracts compound slot components from children", () => {
    render(
      <ThreeZonePanel>
        <ThreeZonePanel.Header>
          <span>Compound Header</span>
        </ThreeZonePanel.Header>
        <ThreeZonePanel.Toolbar>
          <span>Compound Toolbar</span>
        </ThreeZonePanel.Toolbar>
        <ThreeZonePanel.Content>
          <span>Compound Content</span>
        </ThreeZonePanel.Content>
        <ThreeZonePanel.Footer>
          <span>Compound Footer</span>
        </ThreeZonePanel.Footer>
      </ThreeZonePanel>,
    );

    expect(screen.queryByText("Compound Header")).not.toBeNull();
    expect(screen.getByRole("toolbar").textContent).toContain("Compound Toolbar");
    expect(screen.queryByText("Compound Content")).not.toBeNull();
    expect(screen.queryByText("Compound Footer")).not.toBeNull();
  });

  it("falls back to loose children for content when no content slot provided", () => {
    render(
      <ThreeZonePanel>
        <PanelHeader>Top</PanelHeader>
        <PanelToolbar>Tools</PanelToolbar>
        <div>Loose Body</div>
      </ThreeZonePanel>,
    );

    expect(screen.queryByText("Top")).not.toBeNull();
    expect(screen.getByRole("toolbar").textContent).toContain("Tools");
    expect(screen.queryByText("Loose Body")).not.toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("supports variant and content overflow modifiers", () => {
    render(
      <ThreeZonePanel variant="quiet" contentOverflow="hidden">
        <PanelContent>
          <div>Variant Content</div>
        </PanelContent>
      </ThreeZonePanel>,
    );

    const panel = screen.getByRole("group");
    expect(panel.getAttribute("data-variant")).toBe("quiet");

    const contentNode = panel.querySelector(".three-zone-panel__content");
    expect(contentNode).not.toBeNull();
    const content = contentNode as HTMLElement;
    expect(content.classList.contains("three-zone-panel__content--hidden")).toBe(true);
    expect(screen.queryByText("Variant Content")).not.toBeNull();
  });
});
