import { render, waitFor, cleanup } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
  type MemoryHistory,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/router";
import type { RouterContext as AppRouterContext } from "@/router/router-context";
import { createMockAuth, type MockAuthOverrides } from "@/test/utils/providers";
import { ToastProvider } from "@/shared/ui/toast";

interface RenderOptions {
  initialEntry: string;
  auth?: MockAuthOverrides;
}

interface RenderResult {
  history: MemoryHistory;
}

const authState = {
  current: createMockAuth(),
};

vi.mock("@/app/providers", async () => {
  const actual = await vi.importActual<typeof import("@/app/providers")>("@/app/providers");
  return {
    ...actual,
    useAuth: () => authState.current,
  };
});

const mockProjectBundle = {
  project: {
    projectUuid: "mock-project",
    projectName: "Mock Project",
    projectStatus: "READY",
    type: "standard",
    fileCount: 0,
    creationDate: "2024-01-01T00:00:00Z",
    updateDate: "2024-01-02T00:00:00Z",
    clientUuid: null,
    clientName: null,
    notes: null,
  },
  subjects: [],
  languagePairs: [],
  files: [],
  jobs: [],
};

vi.mock("@/core/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/core/ipc")>("@/core/ipc");
  return {
    ...actual,
    getProjectBundle: vi.fn(async () => mockProjectBundle),
    getProjectStatistics: vi.fn(async () => null),
    healthCheck: vi.fn(async () => ({
      appVersion: "test",
      tauriVersion: "test",
      buildProfile: "test",
    })),
  };
});

vi.mock("@/app/hooks/useAppHealth", () => ({
  useAppHealth: () => ({ health: { appVersion: "test", tauriVersion: "test", buildProfile: "test" }, systemError: null, setSystemError: () => undefined }),
}));

function renderAppRouter({ initialEntry, auth: overrides }: RenderOptions): RenderResult {
  const auth = createMockAuth(overrides);
  const history = createMemoryHistory({ initialEntries: [initialEntry] });
  const context: AppRouterContext = { auth };
  authState.current = auth;

  const router = createRouter({
    routeTree,
    history,
    context,
  });

  render(
    <ToastProvider>
      <RouterProvider router={router} context={context} />
    </ToastProvider>,
  );

  return { history };
}

afterEach(() => {
  cleanup();
});

describe("authenticated routing flow", () => {
  it("renders the login shell without mounting the workspace layout", async () => {
    const { history } = renderAppRouter({
      initialEntry: "/login",
      auth: { isAuthenticated: false },
    });

    await waitFor(() => {
      expect(history.location.pathname).toBe("/login");
    });

    const loginPage = document.querySelector(".login-page");
    const workspaceShell = document.querySelector(".layout-shell");

    expect(loginPage).toBeTruthy();
    expect(workspaceShell).toBeNull();
  });

  it("redirects unauthenticated users from workspace routes to /login with a redirect parameter", async () => {
    const { history } = renderAppRouter({
      initialEntry: "/dashboard",
      auth: { isAuthenticated: false },
    });

    await waitFor(() => {
      expect(history.location.pathname).toBe("/login");
    });

    const params = new URLSearchParams(history.location.search);
    expect(params.get("redirect")).toBe("/dashboard");
  });

  it("sends authenticated users away from /login using the stored redirect target", async () => {
    const { history } = renderAppRouter({
      initialEntry: "/login?redirect=/projects/example",
      auth: { isAuthenticated: true },
    });

    await waitFor(() => {
      expect(history.location.pathname).toBe("/projects/example");
    });
  });

  it("falls back to the workspace root when redirect target is unsafe", async () => {
    const { history } = renderAppRouter({
      initialEntry: "/login?redirect=https://malicious.test",
      auth: { isAuthenticated: true },
    });

    await waitFor(() => {
      expect(history.location.pathname).toBe("/");
    });
  });
});
