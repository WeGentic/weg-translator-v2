import { act, render, screen } from "@testing-library/react"
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import { createMockAuth } from "@/test/utils/providers"
import { PageTransitionProvider, usePageTransition } from "@/shared/transitions"

function TransitionProbe() {
  const { phase, isActive, message } = usePageTransition()
  return (
    <div>
      <span data-testid="transition-phase">{phase}</span>
      <span data-testid="transition-active">{isActive ? "true" : "false"}</span>
      <span data-testid="transition-message">{message ?? "none"}</span>
    </div>
  )
}

const rootRoute = createRootRoute({
  component: () => (
    <PageTransitionProvider>
      <TransitionProbe />
      <Outlet />
    </PageTransitionProvider>
  ),
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <div data-testid="dashboard-view">Dashboard</div>,
})

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: () => <div data-testid="projects-view">Projects</div>,
})

const routeTree = rootRoute.addChildren([dashboardRoute, projectsRoute])

describe("PageTransitionProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("drives overlay state through idle → exiting → entering → idle on navigation", async () => {
    const auth = createMockAuth()
    const history = createMemoryHistory({ initialEntries: ["/"] })
    const router = createRouter({
      routeTree,
      history,
      context: { auth },
    })

    render(<RouterProvider router={router} context={{ auth }} />)

    await act(async () => {
      await router.load()
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    const readPhase = () => screen.getByTestId("transition-phase").textContent
    const readActive = () => screen.getByTestId("transition-active").textContent
    const readMessage = () => screen.getByTestId("transition-message").textContent

    expect(readPhase()).toBe("idle")
    expect(readActive()).toBe("false")
    expect(readMessage()).toBe("none")

    let navigation: Promise<void> | undefined

    act(() => {
      navigation = router.navigate({ to: "/projects" })
    })

    expect(readPhase()).toBe("exiting")
    expect(readActive()).toBe("true")
    expect(readMessage()).toBe("Loading Weg Translator…")

    await act(async () => {
      await navigation!
    })

    expect(readPhase()).toBe("entering")
    expect(readActive()).toBe("true")

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(readPhase()).toBe("idle")
    expect(readActive()).toBe("false")
    expect(readMessage()).toBe("none")
    expect(screen.getByTestId("projects-view")).toBeInTheDocument()
  })
})

describe("PageTransitionProvider with reduced motion", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps phase idle and applies reduced-motion styling", async () => {
    const restoreMatchMedia = mockPrefersReducedMotion(true)

    const auth = createMockAuth()
    const history = createMemoryHistory({ initialEntries: ["/"] })
    const router = createRouter({
      routeTree,
      history,
      context: { auth },
    })

    render(<RouterProvider router={router} context={{ auth }} />)

    await act(async () => {
      await router.load()
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    const readPhase = () => screen.getByTestId("transition-phase").textContent
    const readActive = () => screen.getByTestId("transition-active").textContent
    const readMessage = () => screen.getByTestId("transition-message").textContent

    expect(readPhase()).toBe("idle")
    expect(readActive()).toBe("false")

    let navigation: Promise<void> | undefined
    act(() => {
      navigation = router.navigate({ to: "/projects" })
    })

    expect(readPhase()).toBe("idle")
    expect(readActive()).toBe("true")
    expect(readMessage()).toBe("Loading Weg Translator…")

    const overlay = document.querySelector(".transition-overlay")
    expect(overlay).toHaveClass("transition-overlay--reduced")

    await act(async () => {
      await navigation!
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(readPhase()).toBe("idle")
    expect(readActive()).toBe("false")

    restoreMatchMedia()
  })
})
function mockPrefersReducedMotion(value: boolean) {
  const originalMatchMedia = window.matchMedia
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: value && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  return () => {
    window.matchMedia = originalMatchMedia
  }
}
