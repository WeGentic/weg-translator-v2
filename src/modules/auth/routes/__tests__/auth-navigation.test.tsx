import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { describe, expect, it, vi } from "vitest"

import { PageTransitionProvider } from "@/shared/transitions"
import { LoginRoute } from "@/modules/auth/routes"
import { RegistrationRoute } from "@/modules/auth/routes/RegistrationRoute"
import { createMockAuth } from "@/test/utils/providers"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/modules/auth/components/LoginForm", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}))

vi.mock("@/modules/auth/components/forms/RegistrationCompanyStep", () => ({
  RegistrationCompanyStep: () => <div data-testid="registration-company-step" />,
}))

vi.mock("@/modules/auth/components/forms/RegistrationAdminStep", () => ({
  RegistrationAdminStep: () => <div data-testid="registration-admin-step" />,
}))

vi.mock("@/modules/auth/components/forms/RegistrationProgress", () => ({
  RegistrationProgress: () => <div data-testid="registration-progress" />,
}))

vi.mock("@/modules/auth/hooks/controllers/useRegistrationForm", () => {
  const noop = () => {}
  return {
    useRegistrationForm: () => ({
      values: {},
      errors: {},
      touched: {},
      isSubmitting: false,
      stepIndex: 0,
      currentStepKey: "company",
      currentStepBlockingLabels: [],
      formBlockingLabels: [],
      isFirstStep: true,
      isLastStep: false,
      isCurrentStepValid: true,
      isFormValid: false,
      continueTooltipMessage: "Complete current step.",
      submitTooltipMessage: "Submit the form.",
      phoneCountry: "US",
      phoneValue: undefined,
      defaultPhoneCountry: "US",
      phoneDialCode: "+1",
      phoneInputRef: { current: null },
      addressInputRef: { current: null },
      address: {
        listId: "address",
        suggestions: [],
        loading: false,
        error: null,
        lockedValue: null,
        showPanel: false,
        activeIndex: 0,
        setActiveIndex: noop,
        handleFocus: noop,
        handleBlur: noop,
        handleKeyDown: noop,
        handleSuggestionSelect: noop,
        clearSelection: noop,
        clearError: noop,
      },
      handleFieldChange: () => noop,
      handleFieldBlur: noop,
      handlePhoneChange: noop,
      handlePhoneCountryChange: noop,
      handleCompanyAddressChange: noop,
      handleCompanyAddressClear: noop,
      handleSubmit: () => {
        /* no-op */
      },
      handleNextStep: noop,
      handlePreviousStep: noop,
      handleStepSelect: noop,
      goToStep: noop,
      getFieldError: () => "",
      hasFieldBlockingError: () => false,
    }),
  }
})

const rootRoute = createRootRoute({
  component: () => (
    <PageTransitionProvider>
      <Outlet />
    </PageTransitionProvider>
  ),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginRoute,
})

const registrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegistrationRoute,
})

const routeTree = rootRoute.addChildren([loginRoute, registrationRoute])

describe("Auth navigation transitions", () => {

  it("announces transition messaging when switching between login and registration", async () => {
    const auth = createMockAuth()
    const history = createMemoryHistory({ initialEntries: ["/login"] })
    const router = createRouter({
      routeTree,
      history,
      context: { auth },
    })

    render(<RouterProvider router={router} context={{ auth }} />)

    const user = userEvent.setup()

    await act(async () => {
      await router.load()
    })

    await act(async () => {
      await user.click(screen.getByRole("link", { name: /navigate to registration page/i }))
    })

    expect(screen.getByText("Preparing registration form…")).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe("/register"))

    const backButton = screen.getByRole("button", { name: /back to login/i })
    await act(async () => {
      await user.click(backButton)
    })

    expect(screen.getByText("Returning to login…")).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"))
  })
})
