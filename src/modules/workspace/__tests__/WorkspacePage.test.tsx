/* eslint-disable @eslint-react/hooks-extra/no-unnecessary-use-prefix */

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspacePage } from "@/modules/workspace/WorkspacePage";
import { WorkspaceRoute } from "@/modules/workspace";
import { MainLayout } from "@/app/shell";
import { ToastProvider } from "@/shared/ui/toast";
import {
  consumeQueuedWorkspaceMainView,
  queueWorkspaceMainViewIfNeeded,
} from "@/modules/workspace/navigation/main-view-persist";

const TEST_LAYOUT_CONFIG = {
  footer: { mounted: true, visible: true, height: 56 },
  sidebarOne: { mounted: true, width: 64 },
  sidebarTwo: { mounted: true, visible: true, width: 192 },
  background: { mounted: true, visible: true },
} as const;

vi.mock("@/core/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock("@/app/hooks/useAppHealth", () => ({
  useAppHealth: () => ({ systemError: null }),
}));

vi.mock("@/modules/project-manager/ProjectsPanel", () => ({
  ProjectsPanel: () => <div data-testid="projects-panel" />,
}));

vi.mock("@/modules/project-manager", () => ({
  ProjectManagerRoute: () => <div data-testid="project-manager-route" />,
}));

vi.mock("@/modules/project-view", () => ({
  ProjectView: () => <div data-testid="project-overview" />,
  ProjectViewPlaceholder: () => <div data-testid="project-overview-placeholder" />,
}));

vi.mock("@/modules/settings", () => ({
  EnhancedAppSettingsPanel: () => <div data-testid="settings-panel" />,
}));

vi.mock("@/modules/clients", () => ({
  ClientsView: () => <div data-testid="clients-view" />,
}));

describe("WorkspacePage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("opens the editor placeholder when the editor navigation event fires without a project", async () => {
    render(
      <ToastProvider>
        <MainLayout.Root config={TEST_LAYOUT_CONFIG}>
          <WorkspacePage />
        </MainLayout.Root>
      </ToastProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("app:navigate", {
          detail: { view: "editor" },
        }),
      );
    });

    expect(await screen.findByText(/editor redesign in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/^Idle$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close editor/i })).toBeInTheDocument();
  });

  it("switches to clients view when navigation event requests it", async () => {
    render(
      <ToastProvider>
        <MainLayout.Root config={TEST_LAYOUT_CONFIG}>
          <WorkspacePage />
        </MainLayout.Root>
      </ToastProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("app:navigate", {
          detail: { view: "clients" },
        }),
      );
    });

    expect(await screen.findByTestId("clients-view")).toBeInTheDocument();
  });

  it("queues a workspace view when invoked from a non-workspace route", () => {
    window.history.replaceState({}, "", "/dashboard");

    queueWorkspaceMainViewIfNeeded("settings");

    expect(consumeQueuedWorkspaceMainView()).toBe("settings");
  });

  it("does not queue when already on the workspace route", () => {
    window.history.replaceState({}, "", "/");

    queueWorkspaceMainViewIfNeeded("projects");

    expect(consumeQueuedWorkspaceMainView()).toBeUndefined();
  });

  it("consumes the queued workspace view on first render", async () => {
    window.history.replaceState({}, "", "/dashboard");
    queueWorkspaceMainViewIfNeeded("settings");
    window.history.replaceState({}, "", "/");

    render(
      <ToastProvider>
        <MainLayout.Root config={TEST_LAYOUT_CONFIG}>
          <WorkspaceRoute />
        </MainLayout.Root>
      </ToastProvider>,
    );

    expect(await screen.findByTestId("settings-panel")).toBeInTheDocument();
  });
});
