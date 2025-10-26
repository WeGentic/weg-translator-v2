import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROJECT_CLEAR_EVENT,
  PROJECT_FOCUS_EVENT,
  type ProjectFocusDetail,
} from "@/modules/projects/events";
import {
  ProjectFocusSidebarModule,
  projectFocusModuleDefinition,
} from "../projectFocusModule";

const {
  dispatchProjectFocusMock,
  dispatchProjectClearMock,
  queueWorkspaceMainViewMock,
  navigateMock,
} = vi.hoisted(() => ({
  dispatchProjectFocusMock: vi.fn(),
  dispatchProjectClearMock: vi.fn(),
  queueWorkspaceMainViewMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@/modules/projects/events", async () => {
  const actual = await vi.importActual<typeof import("@/modules/projects/events")>(
    "@/modules/projects/events",
  );
  return {
    ...actual,
    dispatchProjectFocus: dispatchProjectFocusMock,
    dispatchProjectClear: dispatchProjectClearMock,
  };
});

vi.mock("@/modules/workspace/navigation/main-view-persist", () => ({
  queueWorkspaceMainView: queueWorkspaceMainViewMock,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

describe("projectFocusModuleDefinition", () => {
  const mapEvent = projectFocusModuleDefinition.trigger?.mapEvent;

  it("returns activation payload when focus detail is provided", () => {
    expect(mapEvent).toBeDefined();
    const detail: ProjectFocusDetail = {
      projectId: "alpha",
      projectName: "Alpha Project",
      source: "navigation",
    };

    const event = new CustomEvent<ProjectFocusDetail>(PROJECT_FOCUS_EVENT, { detail });
    const result = mapEvent?.(event);

    expect(result).toMatchObject({
      payload: detail,
      view: "project",
      allowedViews: ["*"],
    });
  });

  it("requests deactivation when payload is missing", () => {
    expect(mapEvent).toBeDefined();
    const event = new CustomEvent<ProjectFocusDetail | null>(PROJECT_FOCUS_EVENT, {
      detail: null,
    });

    const result = mapEvent?.(event);
    expect(result).toEqual({ action: "deactivate" });
  });
});

describe("<ProjectFocusSidebarModule />", () => {
  const basePayload: ProjectFocusDetail = {
    projectId: "alpha",
    projectName: "Alpha Project",
    source: "navigation",
  };

  const baseContext = {
    view: "project",
    payload: basePayload,
    allowedViews: ["*"] as ReadonlyArray<string>,
    activatedBy: "event" as const,
  };

  beforeEach(() => {
    navigateMock.mockReset().mockResolvedValue(undefined);
    dispatchProjectFocusMock.mockClear();
    dispatchProjectClearMock.mockClear();
    queueWorkspaceMainViewMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("focuses the module on mount", () => {
    const requestFocus = vi.fn();
    render(
      <ProjectFocusSidebarModule
        payload={basePayload}
        context={baseContext}
        deactivate={vi.fn()}
        requestFocus={requestFocus}
      />,
    );

    expect(requestFocus).toHaveBeenCalledTimes(1);
  });

  it("navigates to the project and re-dispatches focus when reopened", () => {
    const deactivate = vi.fn();
    const requestFocus = vi.fn();

    render(
      <ProjectFocusSidebarModule
        payload={basePayload}
        context={baseContext}
        deactivate={deactivate}
        requestFocus={requestFocus}
      />,
    );

    const openButton = screen.getByRole("button", { name: "Open project Alpha Project" });
    fireEvent.click(openButton);

    expect(dispatchProjectFocusMock).toHaveBeenCalledWith({
      projectId: "alpha",
      projectName: "Alpha Project",
      source: "manual",
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/projects/$projectId",
      params: { projectId: "alpha" },
    });
    expect(deactivate).not.toHaveBeenCalled();
  });

  it("clears project focus, queues workspace view, and deactivates when closed", () => {
    const deactivate = vi.fn();

    render(
      <ProjectFocusSidebarModule
        payload={basePayload}
        context={baseContext}
        deactivate={deactivate}
        requestFocus={vi.fn()}
      />,
    );

    navigateMock.mockClear();

    const closeButton = screen.getByRole("button", { name: "Close Alpha Project tab" });
    fireEvent.click(closeButton);

    expect(dispatchProjectClearMock).toHaveBeenCalledTimes(1);
    expect(queueWorkspaceMainViewMock).toHaveBeenCalledWith("projects");
    expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
    expect(deactivate).toHaveBeenCalled();
  });

  it("deactivates when a project clear event is received", () => {
    const deactivate = vi.fn();

    render(
      <ProjectFocusSidebarModule
        payload={basePayload}
        context={baseContext}
        deactivate={deactivate}
        requestFocus={vi.fn()}
      />,
    );

    deactivate.mockClear();

    window.dispatchEvent(new CustomEvent(PROJECT_CLEAR_EVENT));

    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it("self-deactivates when project identifier is missing", () => {
    const deactivate = vi.fn();
    const contextWithoutPayload = {
      ...baseContext,
      payload: undefined,
    };

    render(
      <ProjectFocusSidebarModule
        payload={undefined}
        context={contextWithoutPayload}
        deactivate={deactivate}
        requestFocus={vi.fn()}
      />,
    );

    expect(deactivate).toHaveBeenCalledTimes(1);
  });
});
