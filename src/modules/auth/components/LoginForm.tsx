/**
 * Auth login form view. Presentation only; controller responsibilities migrate to hooks during refactor.
 */
import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  RiEyeLine,
  RiEyeOffLine,
  RiLockPasswordLine,
  RiLoginCircleLine,
  RiLoader4Line,
} from "react-icons/ri";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { HiMail } from "react-icons/hi";


import { useAuth } from "../hooks/useAuth";

import "./css/forms/login/login-form.css";


type FieldKey = "email" | "password";

type FieldErrors = Record<FieldKey, string>;
type TouchedFields = Record<FieldKey, boolean>;

const REQUIRED_MESSAGES: Record<FieldKey, string> = {
  email: "Email is required.",
  password: "Password is required.",
};

const EMPTY_ERRORS: FieldErrors = {
  email: "",
  password: "",
};

const UNTOUCHED: TouchedFields = {
  email: false,
  password: false,
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_ERRORS);
  const [touched, setTouched] = useState<TouchedFields>(UNTOUCHED);

  const { login, isLoading } = useAuth();
  const router = useRouter();

  const setFieldError = useCallback((field: FieldKey, value: string) => {
    setFieldErrors((prev) => (prev[field] === value ? prev : { ...prev, [field]: value }));
  }, []);

  const validateFields = useCallback(
    (nextEmail: string, nextPassword: string) => {
      const nextErrors: FieldErrors = {
        email: nextEmail.trim() ? "" : REQUIRED_MESSAGES.email,
        password: nextPassword.trim() ? "" : REQUIRED_MESSAGES.password,
      };

      setFieldErrors(nextErrors);
      return nextErrors;
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTouched({ email: true, password: true });

      const validation = validateFields(email, password);
      if (validation.email || validation.password) {
        // Inline field validation errors are displayed below each field
        return;
      }

      try {
        const result = await login(email, password);

        // Only proceed with navigation if login was successful
        if (!result.success) {
          // Login failed - toast notification already shown by AuthProvider
          // Do not navigate, do not clear errors
          return;
        }

        // Login successful - clear errors and navigate
        setFieldErrors(EMPTY_ERRORS);
        setTouched(UNTOUCHED);

        const search = router.state.location.search as { redirect?: string };
        const redirectTo =
          typeof search?.redirect === "string" && search.redirect.length > 0
            ? search.redirect
            : "/";

        if (redirectTo === "/" || !redirectTo.startsWith("/")) {
          await router.navigate({ to: "/" });
          return;
        }

        router.history.push(redirectTo);
      } catch (err) {
        // CRITICAL: OrphanedUserError redirect handling - DO NOT MODIFY
        // When AuthProvider detects an orphaned user during login, it throws a special
        // redirect error with message "REDIRECT_TO_RECOVERY" and a redirectUrl property.
        // This is the ONLY error type that AuthProvider throws during login.
        if (err instanceof Error && err.message === "REDIRECT_TO_RECOVERY") {
          // Extract redirectUrl from error object (set by AuthProvider)
          const redirectUrl = (err as Error & { redirectUrl?: string }).redirectUrl;
          if (redirectUrl) {
            // Redirect to recovery route using router
            // Note: Toast notification is already shown by AuthProvider
            router.history.push(redirectUrl);
            return;
          }
        }

        // For all other login errors (invalid credentials, network errors, etc.):
        // - AuthProvider displays toast notification with user-friendly error message
        // - AuthProvider does NOT throw the error (returns gracefully instead)
        // - Therefore, this catch block will never be reached for regular login errors
        // - Inline field validation errors (empty email/password) are still shown below each field
        // - Error is logged by AuthProvider with correlation ID for debugging

        // If we reach this point with a non-redirect error, it's unexpected
        void console.error("Unexpected error in LoginForm catch block:", err);
      }
    },
    [email, login, password, router, validateFields],
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      void handleSubmit(event);
    },
    [handleSubmit],
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (touched.email) {
        setFieldError("email", value.trim() ? "" : REQUIRED_MESSAGES.email);
      }
    },
    [setFieldError, touched.email],
  );

  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      if (touched.password) {
        setFieldError("password", value.trim() ? "" : REQUIRED_MESSAGES.password);
      }
    },
    [setFieldError, touched.password],
  );

  const handleFieldBlur = useCallback(
    (field: FieldKey) => {
      setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
      const value = field === "email" ? email : password;
      setFieldError(field, value.trim() ? "" : REQUIRED_MESSAGES[field]);
    },
    [email, password, setFieldError],
  );

  const emailErrorId = fieldErrors.email ? "login-email-error" : undefined;
  const passwordErrorId = fieldErrors.password ? "login-password-error" : undefined;

  return (
    <Card className="login-form-card w-full">
      <CardHeader className="login-form__header">
        <CardTitle className="login-form__title">Welcome back</CardTitle>
        <CardDescription className="login-form__description">
          Sign in with your credentials.
        </CardDescription>
      </CardHeader>
      <CardContent className="login-form__content">

        <form onSubmit={handleFormSubmit} className="login-form" noValidate>
          <div className="login-form__field">
            <Label htmlFor="email" className="login-form__label">
              Email
            </Label>
            <div className="login-form__input-wrapper">
              <HiMail aria-hidden="true" className="login-form__field-icon" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                onBlur={() => handleFieldBlur("email")}
                className="login-form__input"
                disabled={isLoading}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={emailErrorId}
              />
            </div>
            {touched.email && fieldErrors.email && (
              <p id="login-email-error" className="login-form__field-error" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="login-form__field">
            <Label htmlFor="password" className="login-form__label">
              Password
            </Label>
            <div className="login-form__input-wrapper">
              <RiLockPasswordLine aria-hidden="true" className="login-form__field-icon" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => handlePasswordChange(event.target.value)}
                onBlur={() => handleFieldBlur("password")}
                className="login-form__input"
                disabled={isLoading}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={passwordErrorId}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="login-form__toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <RiEyeOffLine className="login-form__toggle-icon" />
                ) : (
                  <RiEyeLine className="login-form__toggle-icon" />
                )}
              </Button>
            </div>
            {touched.password && fieldErrors.password && (
              <p id="login-password-error" className="login-form__field-error" role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="login-form__actions">
            <div className="login-form__remember">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={isLoading}
                className="login-checkbox"
              />
              <Label htmlFor="remember" className="login-form__remember-text">
                Remember me
              </Label>
            </div>
            <Button variant="link" className="login-form__link" disabled={isLoading}>
              Forgot password?
            </Button>
          </div>

          <Button type="submit" className="login-form__submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <RiLoader4Line aria-hidden="true" className="login-form__spinner" />
                Signing in…
              </>
            ) : (
              <>
                <RiLoginCircleLine aria-hidden="true" className="login-form__submit-icon" />
                Sign in
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
