/* eslint-disable @typescript-eslint/no-unsafe-call */
import { render, screen } from "@testing-library/react";
import { expect } from "vitest";

import { ProjectsHostShell } from "./ProjectsHostShell";

describe("ProjectsHostShell", () => {
  it("renders Projects host contract via props", () => {
    const { container } = render(
      <ProjectsHostShell
        header={<span>Header Content</span>}
        toolbar={<div role="toolbar">Toolbar Content</div>}
        footer={<span>Footer Content</span>}
      >
        <p>Main Area</p>
      </ProjectsHostShell>,
    );

    const host = container.firstElementChild;
    expect(host).not.toBeNull();
    if (!(host instanceof HTMLElement)) {
      throw new Error("ProjectsHostShell root element not rendered");
    }
    expect(host).toHaveClass(
      "flex",
      "h-full",
      "flex-col",
      "overflow-hidden",
      "rounded-tl-xl",
      "rounded-bl-xl",
      "border-t",
      "border-l",
      "border-b",
      "border-border",
      "bg-popover",
      "shadow-sm",
    );

    const headerZone = container.querySelector<HTMLElement>(".projects-table-header-zone");
    expect(headerZone).not.toBeNull();
    expect(headerZone).toHaveAttribute("data-slot", "header");
    expect(headerZone).toHaveTextContent("Header Content");

    expect(container.querySelector(".sidebar-one__logo-divider")).not.toBeNull();

    const toolbarZone = container.querySelector<HTMLElement>(".projects-table-toolbar-zone");
    expect(toolbarZone).not.toBeNull();
    expect(toolbarZone).toHaveAttribute("data-slot", "toolbar");
    expect(screen.getByRole("toolbar")).toHaveTextContent("Toolbar Content");

    const contentZone = container.querySelector<HTMLElement>(".projects-table-main-zone");
    expect(contentZone).not.toBeNull();
    expect(contentZone).toHaveAttribute("data-slot", "content");
    expect(contentZone?.style.overflowY).toBe("auto");
    expect(screen.getByText("Main Area")).toBeInTheDocument();

    const footerZone = container.querySelector<HTMLElement>("[data-slot='footer']");
    expect(footerZone).not.toBeNull();
    expect(footerZone).toHaveTextContent("Footer Content");
  });

  it("supports compound slot components", () => {
    const { container } = render(
      <ProjectsHostShell>
        <ProjectsHostShell.Header>
          <span>Compound Header</span>
        </ProjectsHostShell.Header>
        <ProjectsHostShell.Toolbar>
          <div role="toolbar">Compound Toolbar</div>
        </ProjectsHostShell.Toolbar>
        <ProjectsHostShell.Content>
          <div>Compound Body</div>
        </ProjectsHostShell.Content>
        <ProjectsHostShell.Footer>
          <span>Compound Footer</span>
        </ProjectsHostShell.Footer>
      </ProjectsHostShell>,
    );

    const headerZone = container.querySelector(".projects-table-header-zone");
    expect(headerZone).not.toBeNull();
    expect(headerZone).toHaveTextContent("Compound Header");

    expect(screen.getByRole("toolbar")).toHaveTextContent("Compound Toolbar");

    const mainZone = container.querySelector(".projects-table-main-zone");
    expect(mainZone).not.toBeNull();
    expect(mainZone).toHaveTextContent("Compound Body");

    const footerZone = container.querySelector("[data-slot='footer']");
    expect(footerZone).not.toBeNull();
    expect(footerZone).toHaveTextContent("Compound Footer");
  });

  it("respects content overflow overrides", () => {
    const { container } = render(
      <ProjectsHostShell contentOverflow="hidden">
        <ProjectsHostShell.Content>
          <div>Overflow Body</div>
        </ProjectsHostShell.Content>
      </ProjectsHostShell>,
    );

    const contentZone = container.querySelector<HTMLElement>(".projects-table-main-zone");
    expect(contentZone?.style.overflowY).toBe("hidden");
    expect(screen.getByText("Overflow Body")).toBeInTheDocument();
  });

  it("matches Projects host DOM snapshot", () => {
    const { container } = render(
      <ProjectsHostShell
        header={<span>Snapshot Header</span>}
        toolbar={<div role="toolbar">Snapshot Toolbar</div>}
        footer={<span>Snapshot Footer</span>}
      >
        <div>Snapshot Body</div>
      </ProjectsHostShell>,
    );

    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm"
        data-component="projects-host-shell"
      >
        <div
          class="projects-table-header-zone flex items-center justify-between px-4"
          data-slot="header"
        >
          <span>
            Snapshot Header
          </span>
        </div>
        <div
          aria-hidden="true"
          class="sidebar-one__logo-divider"
        />
        <div
          class="projects-table-toolbar-zone"
          data-slot="toolbar"
        >
          <div
            role="toolbar"
          >
            Snapshot Toolbar
          </div>
        </div>
        <div
          class="flex-1 flex flex-col min-h-0"
        >
          <div
            class="projects-table-main-zone"
            data-slot="content"
            style="overflow-y: auto;"
          >
            <div>
              Snapshot Body
            </div>
          </div>
          <div
            class="flex-shrink-0 border-t-2 border-border bg-gradient-to-r from-muted/15 via-muted/8 to-transparent backdrop-blur-sm shadow-sm"
            data-slot="footer"
          >
            <span>
              Snapshot Footer
            </span>
          </div>
        </div>
      </div>
    `);
  });
});
