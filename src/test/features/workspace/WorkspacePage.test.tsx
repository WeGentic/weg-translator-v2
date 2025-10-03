import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspacePage } from "@/features/workspace/WorkspacePage";
import { MainLayout } from "@/app/layout";

const TEST_LAYOUT_CONFIG = {
  header: { mounted: true, visible: true, height: 64 },
  footer: { mounted: true, visible: true, height: 56 },
  sidebarOne: { mounted: true, width: 64 },
  sidebarTwo: { mounted: true, visible: true, width: 192 },
  background: { mounted: true, visible: true },
} as const;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock("@/app/hooks/useAppHealth", () => ({
  useAppHealth: () => ({ health: null, systemError: null, setSystemError: vi.fn() }),
}));

vi.mock("@/hooks/useHeaderTitle", () => ({
  useHeaderTitle: ({ explicit }: { explicit?: string }) => explicit ?? "Projects",
}));

vi.mock("@/app/layout/main_elements", () => ({
  AppHeader: ({ title }: { title?: string; hideUser?: boolean }) => (
    <header data-testid="app-header">{title ?? "App Header"}</header>
  ),
  WorkspaceFooter: () => <footer data-testid="workspace-footer" />,
}));

vi.mock("@/components/projects/ProjectsPanel", () => ({
  ProjectsPanel: () => <div data-testid="projects-panel" />,
}));

vi.mock("@/components/projects/overview/ProjectOverview", () => ({
  ProjectOverview: () => <div data-testid="project-overview" />,
}));

vi.mock("@/components/projects/overview/ProjectOverviewPlaceholder", () => ({
  ProjectOverviewPlaceholder: () => <div data-testid="project-overview-placeholder" />,
}));

vi.mock("@/components/settings/EnhancedAppSettingsPanel", () => ({
  EnhancedAppSettingsPanel: () => <div data-testid="settings-panel" />,
}));

describe("WorkspacePage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the editor placeholder when the editor navigation event fires without a project", async () => {
    render(
      <MainLayout.Root config={TEST_LAYOUT_CONFIG}>
        <WorkspacePage />
      </MainLayout.Root>,
    );

    await act(async () => {
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
});
