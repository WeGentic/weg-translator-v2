import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import {
  createEmptyRegistrationValues,
  createUntouchedRegistrationTouched,
  type RegistrationTouched,
  type RegistrationValues,
} from "@/modules/auth/utils/validation/registration";
import {
  RegistrationCompanyStep,
  type RegistrationCompanyStepProps,
} from "@/modules/auth/components/forms/RegistrationCompanyStep";
import type { RegistrationAddressState } from "@/modules/auth/hooks/controllers/useRegistrationForm";
import type { RegistrationField } from "@/modules/auth/utils/constants/registration";
import type { CountryCode } from "libphonenumber-js";
import { useCallback, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type { AddressSuggestion } from "@/core/ipc/places";

vi.mock("react-phone-number-input", () => {
  const MockContainer = ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-phone-container">{children}</div>
  );

  interface MockPhoneInputProps {
    value?: string;
    onChange: (value?: string) => void;
    onCountryChange?: (value?: string) => void;
    inputRef?: MutableRefObject<HTMLInputElement | null>;
    containerComponentProps?: Record<string, unknown>;
    numberInputProps?: Record<string, unknown>;
    countrySelectProps?: Record<string, unknown>;
    containerComponent?: unknown;
    [key: string]: unknown;
  }

  const MockPhoneInput = ({
    value,
    onChange,
    inputRef,
    containerComponentProps,
    numberInputProps,
    ...rest
  }: MockPhoneInputProps) => {
    const sanitizedProps = { ...(rest as Record<string, unknown>) };
    delete sanitizedProps.defaultCountry;
    delete sanitizedProps.country;
    delete sanitizedProps.onCountryChange;
    delete sanitizedProps.countrySelectProps;
    delete sanitizedProps.containerComponent;

    return (
      <MockContainer {...(containerComponentProps ?? {})}>
        <input
          data-testid="mock-phone-input"
          ref={inputRef}
          value={value ?? ""}
          {...(numberInputProps ?? {})}
          {...sanitizedProps}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </MockContainer>
    );
  };

  return {
    __esModule: true,
    default: MockPhoneInput,
  };
});

const NOOP_FIELD_CHANGE: RegistrationCompanyStepProps["handleFieldChange"] = () => () => undefined;
const NOOP_FIELD_BLUR: RegistrationCompanyStepProps["handleFieldBlur"] = () => undefined;
const NOOP_PHONE_CHANGE: RegistrationCompanyStepProps["handlePhoneChange"] = () => undefined;
const NOOP_PHONE_COUNTRY_CHANGE: RegistrationCompanyStepProps["handlePhoneCountryChange"] = () => undefined;
const NOOP_ADDRESS_CHANGE: RegistrationCompanyStepProps["handleCompanyAddressChange"] = () => undefined;

const createAddressState = (
  overrides: Partial<RegistrationAddressState> = {},
): RegistrationAddressState => ({
  listId: "address-suggestions",
  suggestions: [],
  loading: false,
  error: null,
  lockedValue: null,
  showPanel: false,
  activeIndex: -1,
  setActiveIndex: vi.fn(),
  handleFocus: vi.fn(),
  handleBlur: vi.fn(),
  handleKeyDown: vi.fn(),
  handleSuggestionSelect: vi.fn(),
  clearSelection: vi.fn(),
  clearError: vi.fn(),
  ...overrides,
});

const createRefObject = (): MutableRefObject<HTMLInputElement | null> => ({
  current: null,
});

const US_COUNTRY_CODE = "US" as CountryCode;

const getFieldErrorFactory =
  (overrides: Partial<Record<RegistrationField, string>> = {}) =>
  (field: RegistrationField): string =>
    overrides[field] ?? "";

let requestAnimationFrameSpy: MockInstance<typeof window.requestAnimationFrame>;
let cancelAnimationFrameSpy: MockInstance<typeof window.cancelAnimationFrame>;

beforeAll(() => {
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 16);
    };
  }
  if (typeof window.cancelAnimationFrame !== "function") {
    window.cancelAnimationFrame = (handle: number) => {
      window.clearTimeout(handle);
    };
  }
});

beforeEach(() => {
  requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  requestAnimationFrameSpy.mockRestore();
  cancelAnimationFrameSpy.mockRestore();
});

afterAll(() => {
  vi.clearAllMocks();
});

const renderRegistrationCompanyStep = ({
  values,
  touched,
  address,
  handleCompanyAddressClear,
}: {
  values: RegistrationValues;
  touched: RegistrationTouched;
  address: RegistrationAddressState;
  handleCompanyAddressClear: () => void;
}) => {
  render(
    <RegistrationCompanyStep
      values={values}
      touched={touched}
      isSubmitting={false}
      phoneValue={undefined}
      phoneCountry={US_COUNTRY_CODE}
      defaultPhoneCountry={US_COUNTRY_CODE}
      phoneDialCode="+1"
      phoneInputRef={createRefObject()}
      addressInputRef={createRefObject()}
      address={address}
      handleFieldChange={NOOP_FIELD_CHANGE}
      handleFieldBlur={NOOP_FIELD_BLUR}
      handlePhoneChange={NOOP_PHONE_CHANGE}
      handlePhoneCountryChange={NOOP_PHONE_COUNTRY_CHANGE}
      handleCompanyAddressChange={NOOP_ADDRESS_CHANGE}
      handleCompanyAddressClear={handleCompanyAddressClear}
      getFieldError={getFieldErrorFactory({
        companyAddress: touched.companyAddress ? "Company address is required" : "",
      })}
    />,
  );
};

describe("RegistrationCompanyStep - locked address field", () => {
  it("renders a read-only preview with clear action and focus management", async () => {
    const values = createEmptyRegistrationValues();
    values.companyAddress = "123 Localization Ave, Suite 400";

    const touched = createUntouchedRegistrationTouched();
    touched.companyAddress = true;

    const handleCompanyAddressClear = vi.fn();
    const address = createAddressState({
      lockedValue: values.companyAddress,
      handleFocus: vi.fn(),
    });

    renderRegistrationCompanyStep({ values, touched, address, handleCompanyAddressClear });

    const lockedTextbox = screen.getByRole("textbox", { name: /company address/i });
    expect(lockedTextbox).toHaveAttribute("aria-readonly", "true");
    expect(lockedTextbox).toHaveAttribute("aria-describedby", "company-address-error");
    expect(lockedTextbox).toHaveTextContent(values.companyAddress);

    const clearButton = screen.getByRole("button", { name: /clear selected address/i });
    await waitFor(() => expect(clearButton).toHaveFocus());

    const user = userEvent.setup();
    await user.click(clearButton);

    expect(handleCompanyAddressClear).toHaveBeenCalledTimes(1);
    expect(address.handleFocus).toHaveBeenCalledTimes(1);
  });

  it("locks the address after selecting a suggestion", async () => {
    const suggestion: AddressSuggestion = {
      id: "suggestion-1",
      primaryText: "456 Localization Blvd",
      secondaryText: "Suite 12",
      structured: {
        components: {},
      },
    };

    const user = userEvent.setup();

    const Harness = () => {
      const [values, setValues] = useState<RegistrationValues>(() => createEmptyRegistrationValues());
      const [touched, setTouched] = useState<RegistrationTouched>(() =>
        createUntouchedRegistrationTouched(),
      );
      const [lockedValue, setLockedValue] = useState<string | null>(null);
      const [showPanel, setShowPanel] = useState(true);

      const handleCompanyAddressClear = useCallback(() => {
        setLockedValue(null);
        setValues((prev) => ({ ...prev, companyAddress: "" }));
        setTouched((prev) => ({ ...prev, companyAddress: false }));
        setShowPanel(true);
      }, []);

      const address = useMemo<RegistrationAddressState>(
        () => ({
          listId: "address-suggestions",
          suggestions: lockedValue ? [] : [suggestion],
          loading: false,
          error: null,
          lockedValue,
          showPanel,
          activeIndex: 0,
          setActiveIndex: vi.fn(),
          handleFocus: () => setShowPanel(true),
          handleBlur: () => setShowPanel(false),
          handleKeyDown: vi.fn(),
          handleSuggestionSelect: (selected) => {
            setLockedValue(selected.primaryText);
            setValues((prev) => ({ ...prev, companyAddress: selected.primaryText }));
            setTouched((prev) => ({ ...prev, companyAddress: true }));
            setShowPanel(false);
          },
          clearSelection: () => {
            setLockedValue(null);
            setShowPanel(true);
          },
          clearError: vi.fn(),
        }),
        [lockedValue, showPanel],
      );

      const handleFieldChange = useCallback<RegistrationCompanyStepProps["handleFieldChange"]>(
        (field) => (event) => {
          const nextValue = event.currentTarget.value;
          setValues((prev) => ({ ...prev, [field]: nextValue }));
        },
        [],
      );

      const handleFieldBlur = useCallback<RegistrationCompanyStepProps["handleFieldBlur"]>(
        (field) => {
          setTouched((prev) => ({ ...prev, [field]: true }));
        },
        [],
      );

      const handleCompanyAddressChange = useCallback<
        RegistrationCompanyStepProps["handleCompanyAddressChange"]
      >((event) => {
        const value = event.currentTarget.value;
        setValues((prev) => ({ ...prev, companyAddress: value }));
        setTouched((prev) => ({ ...prev, companyAddress: value.length > 0 }));
      }, []);

      const getFieldError = useCallback<RegistrationCompanyStepProps["getFieldError"]>(
        (field) => {
          if (field === "companyAddress" && touched.companyAddress && !values.companyAddress.length) {
            return "Company address is required";
          }
          return "";
        },
        [touched, values.companyAddress.length],
      );

      const phoneInputRef = useRef<HTMLInputElement | null>(null);
      const addressInputRef = useRef<HTMLInputElement | null>(null);

      return (
        <RegistrationCompanyStep
          values={values}
          touched={touched}
          isSubmitting={false}
          phoneValue=""
          phoneCountry={US_COUNTRY_CODE}
          defaultPhoneCountry={US_COUNTRY_CODE}
          phoneDialCode="+1"
          phoneInputRef={phoneInputRef}
          addressInputRef={addressInputRef}
          address={address}
          handleFieldChange={handleFieldChange}
          handleFieldBlur={handleFieldBlur}
          handlePhoneChange={NOOP_PHONE_CHANGE}
          handlePhoneCountryChange={NOOP_PHONE_COUNTRY_CHANGE}
          handleCompanyAddressChange={handleCompanyAddressChange}
          handleCompanyAddressClear={handleCompanyAddressClear}
          getFieldError={getFieldError}
        />
      );
    };

    render(<Harness />);

    const optionButton = screen.getByRole("option", { name: /456 localization blvd/i });
    await user.click(optionButton);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /company address/i })).toHaveTextContent(
        suggestion.primaryText,
      );
    });

    const clearButton = screen.getByRole("button", { name: /clear selected address/i });
    expect(clearButton).toBeInTheDocument();
  });
});
