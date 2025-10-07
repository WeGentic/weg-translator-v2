import type { ComponentType, PropsWithChildren, ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
  type AnyRouter,
} from "@tanstack/react-router";
import { vi } from "vitest";

import type { useAuth } from "@/app/providers";

export type AuthContextValue = ReturnType<typeof useAuth>;

export type MockAuthOverrides = Partial<AuthContextValue>;

export function createMockAuth(overrides: MockAuthOverrides = {}): AuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    session: null,
    ...overrides,
  };
}

export interface CreateTestRouterOptions {
  route?: string;
  auth?: MockAuthOverrides;
}

export interface RenderWithRouterOptions extends CreateTestRouterOptions {
  wrapper?: ComponentType<PropsWithChildren>;
  renderOptions?: RenderOptions;
}

type MemoryHistory = ReturnType<typeof createMemoryHistory>;
type TestingLibraryRenderResult = ReturnType<typeof render>;

export interface RenderWithRouterResult extends TestingLibraryRenderResult {
  router: AnyRouter;
  auth: AuthContextValue;
  history: MemoryHistory;
}

export function renderWithRouter(
  ui: ReactElement,
  options: RenderWithRouterOptions = {},
) {
  const { route = "/", auth: authOverrides, wrapper: Wrapper, renderOptions } = options;
  const auth = createMockAuth(authOverrides);
  const history = createMemoryHistory({ initialEntries: [route] });

  const rootRoute = createRootRoute({
    component: () => (Wrapper ? <Wrapper>{ui}</Wrapper> : ui),
  });

  const router = createRouter({
    routeTree: rootRoute,
    history,
    context: { auth },
  });

  const result = render(<RouterProvider router={router} context={{ auth }} />, renderOptions);

  return Object.assign(result, {
    router,
    auth,
    history,
  }) as RenderWithRouterResult;
}
