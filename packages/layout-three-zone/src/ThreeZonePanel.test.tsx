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

    const header = screen.getByText("Header Content").closest("header");
    expect(header).not.toBeNull();
    expect(header).toHaveAttribute("data-slot", "header");

    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveTextContent("Toolbar Content");
    expect(toolbar).toHaveAttribute("data-slot", "toolbar");

    expect(screen.getByText("Body Content")).toBeInTheDocument();
    expect(screen.getByText("Footer Content")).toBeInTheDocument();
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

    expect(screen.getByText("Compound Header")).toBeInTheDocument();
    expect(screen.getByRole("toolbar")).toHaveTextContent("Compound Toolbar");
    expect(screen.getByText("Compound Content")).toBeInTheDocument();
    expect(screen.getByText("Compound Footer")).toBeInTheDocument();
  });

  it("falls back to loose children for content when no content slot provided", () => {
    render(
      <ThreeZonePanel>
        <PanelHeader>Top</PanelHeader>
        <PanelToolbar>Tools</PanelToolbar>
        <div>Loose Body</div>
      </ThreeZonePanel>,
    );

    expect(screen.getByText("Top")).toBeInTheDocument();
    expect(screen.getByRole("toolbar")).toHaveTextContent("Tools");
    expect(screen.getByText("Loose Body")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
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
    expect(panel).toHaveAttribute("data-variant", "quiet");

    const content = panel.querySelector(".three-zone-panel__content");
    expect(content).toHaveClass("three-zone-panel__content--hidden");
    expect(screen.getByText("Variant Content")).toBeInTheDocument();
  });
});
