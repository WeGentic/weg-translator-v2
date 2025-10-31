import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  AuthError,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/core/config";
import { logger } from "@/core/logging";
import { useToast } from "@/shared/ui/toast";
import { checkIfOrphaned } from "@/modules/auth/utils/orphanDetection";

const POLL_BASE_DELAY_MS = 5_000;
const POLL_MAX_DELAY_MS = 60_000;
const VERIFY_MANUAL_LOCK_MS = 2_000;

export type SubmissionPhase =
  | "idle"
  | "signingUp"
  | "awaitingVerification"
  | "verifying"
  | "persisting"
  | "succeeded"
  | "failed";

export interface SubmissionError {
  code: string;
  message: string;
  source: "supabase" | "network" | "unknown";
  details?: unknown;
}

export interface NormalizedRegistrationPayload {
  admin: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  };
  company: {
    name: string;
    email: string;
    phone: string;
    taxId: string;
    taxCountryCode?: string;
    address: {
      freeform: string;
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      countryCode?: string | null;
    };
  };
}

interface SubmissionSuccessResult {
  accountUuid: string;
  userUuid: string;
  subscriptionUuid: string;
  payload: NormalizedRegistrationPayload;
}

interface SubmissionState {
  phase: SubmissionPhase;
  attemptId: string | null;
  error: SubmissionError | null;
  adminUuid: string | null;
  payload: NormalizedRegistrationPayload | null;
  result: SubmissionSuccessResult | null;
}

type SubmissionAction =
  | {
      type: "start";
      attemptId: string;
      payload: NormalizedRegistrationPayload;
    }
  | {
      type: "await-verification";
      adminUuid: string | null;
    }
  | { type: "verifying" }
  | { type: "persisting" }
  | { type: "success"; result: SubmissionSuccessResult }
  | { type: "fail"; error: SubmissionError }
  | { type: "reset" };

const INITIAL_STATE: SubmissionState = {
  phase: "idle",
  attemptId: null,
  error: null,
  adminUuid: null,
  payload: null,
  result: null,
};

function submissionReducer(state: SubmissionState, action: SubmissionAction): SubmissionState {
  switch (action.type) {
    case "start":
      return {
        phase: "signingUp",
        attemptId: action.attemptId,
        error: null,
        adminUuid: null,
        payload: action.payload,
        result: null,
      };
    case "await-verification":
      return {
        ...state,
        phase: "awaitingVerification",
        adminUuid: action.adminUuid ?? state.adminUuid,
        error: null,
      };
    case "verifying":
      return {
        ...state,
        phase: "verifying",
        error: null,
      };
    case "persisting":
      return {
        ...state,
        phase: "persisting",
        error: null,
      };
    case "success":
      return {
        ...state,
        phase: "succeeded",
        result: action.result,
        adminUuid: action.result.userUuid,
        error: null,
      };
    case "fail":
      return {
        ...state,
        phase: "failed",
        error: action.error,
      };
    case "reset":
      return INITIAL_STATE;
    default:
      return state;
  }
}

function mapAuthError(error: AuthError): SubmissionError {
  const code = error.name || "supabase_error";
  const message =
    typeof error.message === "string" && error.message.trim().length > 0
      ? error.message
      : "Supabase rejected the sign-up request.";

  return {
    code,
    message,
    source: "supabase",
    details: { status: error.status },
  };
}

function isEmailNotConfirmedError(error: AuthError): boolean {
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  const status = typeof (error as { status?: number | undefined }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  if (status === 400 && message.includes("not confirmed")) {
    return true;
  }

  return message.includes("email not confirmed");
}

function isUserAlreadyExistsError(error: AuthError): boolean {
  const code = (error as { code?: string }).code;
  if (typeof code === "string" && code.toLowerCase() === "user_already_exists") {
    return true;
  }

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return (
    message.includes("user already registered") ||
    message.includes("email already exists") ||
    message.includes("already registered")
  );
}

function createSubmissionError(params: SubmissionError): SubmissionError {
  return params;
}

function mapUnknownError(error: unknown): SubmissionError {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return {
      code: "unexpected_error",
      message: error.message,
      source: "unknown",
    };
  }

  return {
    code: "unexpected_error",
    message: "An unexpected error occurred while submitting registration.",
    source: "unknown",
    details: error,
  };
}

function mapVerificationError(error: unknown): SubmissionError {
  if (error instanceof AuthError) {
    return mapAuthError(error);
  }
  if (error instanceof Error) {
    return {
      code: error.name || "verification_error",
      message: error.message || "Unable to verify email confirmation status.",
      source: "network",
    };
  }

  return {
    code: "verification_error",
    message: "Unable to confirm your email status right now.",
    source: "network",
    details: error,
  };
}

function mapFunctionInvokeError(error: unknown): SubmissionError {
  if (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    const status = "status" in error ? (error as { status?: number }).status : undefined;

    // Map specific HTTP status codes to user-friendly errors
    if (status === 409) {
      // HTTP 409 Conflict - Email already exists
      return {
        code: "EMAIL_EXISTS",
        message: "This email is already registered. Please login or use a different email.",
        source: "network",
        details: { status },
      };
    }

    if (status === 401) {
      // HTTP 401 Unauthorized - Email not verified
      return {
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before creating an account.",
        source: "network",
        details: { status },
      };
    }

    if (status === 500) {
      // HTTP 500 Internal Server Error - Allow retry
      return {
        code: "INTERNAL_SERVER_ERROR",
        message: "Registration request failed. Please try again.",
        source: "network",
        details: { status },
      };
    }

    return {
      code: error.name || "edge_function_error",
      message: error.message || "Edge Function request failed.",
      source: "network",
      details: { status },
    };
  }

  if (error instanceof Error) {
    return {
      code: error.name || "edge_function_error",
      message: error.message || "Edge Function request failed.",
      source: "network",
    };
  }

  return {
    code: "edge_function_error",
    message: "Edge Function request failed.",
    source: "network",
    details: error,
  };
}

interface PersistenceSuccess {
  kind: "success";
  accountUuid: string;
  userUuid: string;
  subscriptionUuid: string;
}

interface PersistenceFailure {
  kind: "error";
  error: SubmissionError;
}

type PersistenceResult = PersistenceSuccess | PersistenceFailure;

export interface UseRegistrationSubmissionResult {
  phase: SubmissionPhase;
  attemptId: string | null;
  adminUuid: string | null;
  error: SubmissionError | null;
  result: SubmissionSuccessResult | null;
  isSubmitting: boolean;
  isLocked: boolean;
  payload: NormalizedRegistrationPayload | null;
  submit: (payload: NormalizedRegistrationPayload) => Promise<void>;
  confirmVerification: (options?: { manual?: boolean }) => Promise<void>;
  reset: () => void;
}

export function useRegistrationSubmission(): UseRegistrationSubmissionResult {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(submissionReducer, INITIAL_STATE);

  const stateRef = useRef(state);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);
  const lastManualCheckRef = useRef<number>(0);
  const runVerificationCheckRef = useRef<(manual: boolean) => void>(() => {});

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPollTimer();
    };
  }, [clearPollTimer]);

  const computeNextDelay = (attempt: number) => {
    const multiplier = Math.max(1, attempt);
    const delay = POLL_BASE_DELAY_MS * 2 ** (multiplier - 1);
    return Math.min(delay, POLL_MAX_DELAY_MS);
  };

  const scheduleVerificationPoll = useCallback(() => {
    clearPollTimer();
    const currentState = stateRef.current;
    if (currentState.phase !== "awaitingVerification") {
      return;
    }

    const attemptNumber = pollAttemptsRef.current + 1;
    const delay = computeNextDelay(attemptNumber);
    pollAttemptsRef.current = attemptNumber;

    pollTimerRef.current = window.setTimeout(() => {
      pollTimerRef.current = null;
      runVerificationCheckRef.current(false);
    }, delay);

    void logger.debug("Scheduled verification poll", {
      attempt: attemptNumber,
      delay_ms: delay,
      attempt_id: currentState.attemptId ?? "<unknown>",
    });
  }, [clearPollTimer]);

  const persistRegistration = useCallback(
    async (
      payload: NormalizedRegistrationPayload,
      attemptId: string | null,
      _adminUuid: string,
    ): Promise<PersistenceResult> => {
      try {
        // Validate company_email matches admin_email
        if (payload.company.email.trim().toLowerCase() !== payload.admin.email.trim().toLowerCase()) {
          return {
            kind: "error",
            error: createSubmissionError({
              code: "email_mismatch",
              message: "Company email must match your admin email",
              source: "unknown",
            }),
          };
        }

        // Generate correlation ID for request tracing
        const correlationId = attemptId ?? crypto.randomUUID();

        // Construct new Edge Function payload matching create_account_with_admin signature
        const body = {
          company_name: payload.company.name,
          company_email: payload.company.email,
          first_name: payload.admin.first_name ?? null,
          last_name: payload.admin.last_name ?? null,
          correlationId,
        };

        const { data, error } = await supabase.functions.invoke("register-organization", {
          body,
          headers: {
            "x-correlation-id": correlationId,
          },
        });

        if (error) {
          return { kind: "error", error: mapFunctionInvokeError(error) };
        }

        // Parse new Edge Function response structure
        const parsed = data as
          | {
              success?: boolean;
              account_uuid?: string;
              user_uuid?: string;
              subscription_uuid?: string;
              error?: string;
              message?: string;
              correlationId?: string;
            }
          | null
          | undefined;

        // Handle error responses from Edge Function
        if (parsed?.error) {
          return {
            kind: "error",
            error: createSubmissionError({
              code: parsed.error,
              message: parsed.message ?? "Registration failed",
              source: "network",
              details: { correlationId: parsed.correlationId },
            }),
          };
        }

        // Validate success response structure
        if (!parsed?.success) {
          return {
            kind: "error",
            error: createSubmissionError({
              code: "edge_function_invalid_response",
              message: "Edge Function response was missing success status.",
              source: "network",
              details: parsed,
            }),
          };
        }

        const accountUuid = parsed.account_uuid;
        const userUuid = parsed.user_uuid;
        const subscriptionUuid = parsed.subscription_uuid;

        if (!accountUuid) {
          return {
            kind: "error",
            error: createSubmissionError({
              code: "edge_function_invalid_response",
              message: "Edge Function response was missing the account identifier.",
              source: "network",
              details: parsed,
            }),
          };
        }

        if (!userUuid) {
          return {
            kind: "error",
            error: createSubmissionError({
              code: "edge_function_invalid_response",
              message: "Edge Function response was missing the user identifier.",
              source: "network",
              details: parsed,
            }),
          };
        }

        if (!subscriptionUuid) {
          return {
            kind: "error",
            error: createSubmissionError({
              code: "edge_function_invalid_response",
              message: "Edge Function response was missing the subscription identifier.",
              source: "network",
              details: parsed,
            }),
          };
        }

        return {
          kind: "success",
          accountUuid,
          userUuid,
          subscriptionUuid,
        };
      } catch (cause) {
        return { kind: "error", error: mapFunctionInvokeError(cause) };
      }
    },
    [],
  );

  const runVerificationCheck = useCallback(
    async (manual: boolean) => {
      const now = Date.now();
      if (manual && now - lastManualCheckRef.current < VERIFY_MANUAL_LOCK_MS) {
        return;
      }

      const currentState = stateRef.current;
      if (currentState.phase !== "awaitingVerification" && !manual) {
        return;
      }
      const payload = currentState.payload;
      if (!payload || inFlightRef.current) {
        if (manual) {
          toast({
            variant: "destructive",
            title: "Registration is busy",
            description: "Please wait for the current registration step to finish.",
          });
        }
        return;
      }

      clearPollTimer();
      pollAttemptsRef.current = manual ? pollAttemptsRef.current : pollAttemptsRef.current;
      lastManualCheckRef.current = now;
      dispatch({ type: "verifying" });

      const verificationPromise = (async () => {
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            throw sessionError;
          }

          const sessionUser = sessionData?.session?.user ?? null;
          let supabaseUser: User | null = sessionUser;

          if (!supabaseUser) {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: payload.admin.email,
              password: payload.admin.password,
            });

            if (error) {
              if (isEmailNotConfirmedError(error)) {
                if (manual) {
                  pollAttemptsRef.current = 0;
                  toast({
                    title: "Still waiting for verification",
                    description: "Check your inbox for the confirmation email, then try again.",
                  });
                }

                dispatch({
                  type: "await-verification",
                  adminUuid: currentState.adminUuid ?? null,
                });

                scheduleVerificationPoll();
                return;
              }

              throw error;
            }

            supabaseUser = data?.user ?? null;
          }

          if (!supabaseUser) {
            if (manual) {
              pollAttemptsRef.current = 0;
              toast({
                title: "Still waiting for verification",
                description: "Check your inbox for the confirmation email, then try again.",
              });
            }

            dispatch({
              type: "await-verification",
              adminUuid: currentState.adminUuid ?? null,
            });

            scheduleVerificationPoll();
            return;
          }

          const emailConfirmed = Boolean(supabaseUser.email_confirmed_at);

          if (!emailConfirmed) {
            if (manual) {
              pollAttemptsRef.current = 0;
              toast({
                title: "Still waiting for verification",
                description: "Check your inbox for the confirmation email, then try again.",
              });
            }

            dispatch({
              type: "await-verification",
              adminUuid: supabaseUser.id ?? currentState.adminUuid ?? null,
            });

            scheduleVerificationPoll();
            return;
          }

          dispatch({ type: "persisting" });

          const persistence = await persistRegistration(
            payload,
            currentState.attemptId,
            supabaseUser.id,
          );

          if (persistence.kind === "error") {
            dispatch({ type: "fail", error: persistence.error });
            toast({
              variant: "destructive",
              title: "Registration failed",
              description: persistence.error.message,
            });
            return;
          }

          const persistenceResult = {
            accountUuid: persistence.accountUuid,
            userUuid: persistence.userUuid,
            subscriptionUuid: persistence.subscriptionUuid,
          };

          // Post-registration orphan check: verify user has valid account membership
          try {
            const orphanCheck = await checkIfOrphaned(supabaseUser.id);

            void logger.info("Post-registration orphan check completed", {
              attempt_id: currentState.attemptId ?? "<none>",
              account_uuid: persistenceResult.accountUuid,
              user_uuid: persistenceResult.userUuid,
              subscription_uuid: persistenceResult.subscriptionUuid,
              orphaned: orphanCheck.orphaned,
              has_valid_account: orphanCheck.hasValidAccount,
            });

            if (orphanCheck.orphaned) {
              void logger.warn("Post-registration orphan detected (unexpected)", {
                attempt_id: currentState.attemptId ?? "<none>",
                user_uuid: persistenceResult.userUuid,
                orphan_type: orphanCheck.orphanType,
              });
            }
          } catch (orphanError) {
            // Log orphan check failure but don't block registration success
            void logger.warn("Post-registration orphan check failed (non-blocking)", {
              attempt_id: currentState.attemptId ?? "<none>",
              user_uuid: persistenceResult.userUuid,
              error: orphanError instanceof Error ? orphanError.message : String(orphanError),
            });
          }

          dispatch({
            type: "success",
            result: {
              ...persistenceResult,
              payload,
            },
          });
          toast({
            title: "Registration complete",
            description: `Your organization "${payload.company.name}" has been verified and created successfully. You have been assigned as the owner.`,
          });

          void logger.info("Registration persisted", {
            attempt_id: currentState.attemptId ?? "<none>",
            account_uuid: persistenceResult.accountUuid,
            user_uuid: persistenceResult.userUuid,
            subscription_uuid: persistenceResult.subscriptionUuid,
          });
        } catch (cause) {
          const submissionError = mapVerificationError(cause);
          dispatch({ type: "fail", error: submissionError });

          toast({
            variant: "destructive",
            title: "Verification check failed",
            description: submissionError.message,
          });

          void logger.warn("Verification check failed", {
            attempt_id: currentState.attemptId ?? "<unknown>",
            error: submissionError.message,
            code: submissionError.code,
          });
        }
      })();

      inFlightRef.current = verificationPromise;
      try {
        await verificationPromise;
      } finally {
        inFlightRef.current = null;
        const latestState = stateRef.current;
        if (latestState.phase === "awaitingVerification") {
          scheduleVerificationPoll();
        }
      }
    },
    [clearPollTimer, persistRegistration, scheduleVerificationPoll, toast],
  );

  runVerificationCheckRef.current = (manual: boolean) => {
    void runVerificationCheck(manual);
  };

  const reset = useCallback(() => {
    if (inFlightRef.current) {
      return;
    }
    clearPollTimer();
    pollAttemptsRef.current = 0;
    dispatch({ type: "reset" });
  }, [clearPollTimer]);

  const submit = useCallback(
    async (payload: NormalizedRegistrationPayload) => {
      if (inFlightRef.current) {
        return;
      }

      const attemptId = crypto.randomUUID();
      dispatch({ type: "start", attemptId, payload });

      const resumeExistingAccount = async () => {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: payload.admin.email,
          password: payload.admin.password,
        });

        if (signInError) {
          if (signInError instanceof AuthError && isEmailNotConfirmedError(signInError)) {
            pollAttemptsRef.current = 0;
            dispatch({
              type: "await-verification",
              adminUuid: null,
            });
            scheduleVerificationPoll();

            toast({
              title: "Verify your email",
              description:
                "We found an existing account for this email. Confirm the verification link to finish registration.",
            });

            void logger.info("Registration resume awaiting verification", {
              attempt_id: attemptId,
              correlation_id: attemptId,
            });
            return;
          }

          const mappedError =
            signInError instanceof AuthError
              ? createSubmissionError({
                  code: signInError.name || "invalid_credentials",
                  message:
                    signInError.message && signInError.message.trim().length > 0
                      ? signInError.message
                      : "Incorrect password. Reset your password to continue.",
                  source: "supabase",
                  details: { status: (signInError as { status?: number }).status },
                })
              : mapUnknownError(signInError);

          dispatch({ type: "fail", error: mappedError });

          toast({
            variant: "destructive",
            title: "Registration failed",
            description: mappedError.message,
          });

          void logger.warn("Registration resume sign-in failed", {
            attempt_id: attemptId,
            error: mappedError.message,
            code: mappedError.code,
          });
          return;
        }

        const resumedUser = signInData?.user ?? null;
        const resolvedAdminUuid = resumedUser?.id ?? stateRef.current.adminUuid;

        if (!resolvedAdminUuid) {
          const error = createSubmissionError({
            code: "resume_missing_admin",
            message:
              "We signed you in, but could not determine the administrator account. Contact support.",
            source: "unknown",
          });
          dispatch({ type: "fail", error });
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: error.message,
          });
          void logger.error("Registration resume missing admin UUID", null, {
            attempt_id: attemptId,
          });
          return;
        }

        pollAttemptsRef.current = 0;
        dispatch({ type: "persisting" });

        toast({
          title: "Completing registration",
          description: `We're finalizing "${payload.company.name}".`,
        });

        const persistenceResult = await persistRegistration(payload, attemptId, resolvedAdminUuid);

        if (persistenceResult.kind === "error") {
          dispatch({ type: "fail", error: persistenceResult.error });
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: persistenceResult.error.message,
          });
          void logger.error("Registration persistence failed during resume", null, {
            attempt_id: attemptId,
            user_uuid: resolvedAdminUuid,
            error_code: persistenceResult.error.code,
          });
          return;
        }

        try {
          const orphanCheck = await checkIfOrphaned(resolvedAdminUuid);

          void logger.info("Post-registration orphan check completed", {
            attempt_id: attemptId,
            account_uuid: persistenceResult.accountUuid,
            user_uuid: persistenceResult.userUuid,
            subscription_uuid: persistenceResult.subscriptionUuid,
            orphaned: orphanCheck.orphaned,
            has_valid_account: orphanCheck.hasValidAccount,
          });

          if (orphanCheck.orphaned) {
            void logger.warn("Post-registration orphan detected (unexpected)", {
              attempt_id: attemptId,
              user_uuid: persistenceResult.userUuid,
              orphan_type: orphanCheck.orphanType,
            });
          }
        } catch (orphanError) {
          void logger.warn("Post-registration orphan check failed (non-blocking)", {
            attempt_id: attemptId,
            user_uuid: persistenceResult.userUuid,
            error: orphanError instanceof Error ? orphanError.message : String(orphanError),
          });
        }

        dispatch({
          type: "success",
          result: {
            ...persistenceResult,
            payload,
          },
        });

        toast({
          title: "Registration complete",
          description: `Your organization "${payload.company.name}" has been created successfully.`,
        });

        void logger.info("Registration resume persisted", {
          attempt_id: attemptId,
          user_uuid: persistenceResult.userUuid,
          account_uuid: persistenceResult.accountUuid,
          subscription_uuid: persistenceResult.subscriptionUuid,
        });
      };

      const request = (async () => {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: payload.admin.email,
            password: payload.admin.password,
            options: {
              data: {
                company_name: payload.company.name,
                company_phone: payload.company.phone,
                tax_id: payload.company.taxId,
              },
            },
          });

          if (error) {
            if (error instanceof AuthError && isUserAlreadyExistsError(error)) {
              await resumeExistingAccount();
              return;
            }
            throw error;
          }

          pollAttemptsRef.current = 0;
          dispatch({
            type: "await-verification",
            adminUuid: data.user?.id ?? null,
          });
          scheduleVerificationPoll();

          toast({
            title: "Verify your email",
            description: "We sent a confirmation link to your inbox. Open it to continue.",
          });

          void logger.info("Registration sign-up submitted", {
            attempt_id: attemptId,
            admin_uuid: data.user?.id ?? "<none>",
            correlation_id: attemptId,
          });
        } catch (cause) {
          const submissionError = cause instanceof AuthError ? mapAuthError(cause) : mapUnknownError(cause);

          dispatch({ type: "fail", error: submissionError });

          toast({
            variant: "destructive",
            title: "Registration failed",
            description: submissionError.message,
          });

          void logger.error("Registration sign-up failed", cause, {
            attempt_id: attemptId,
            error_code: submissionError.code,
          });
        } finally {
          inFlightRef.current = null;
        }
      })();

      inFlightRef.current = request;
      await request;
    },
    [scheduleVerificationPoll, toast],
  );

  const confirmVerification = useCallback(
    async (options?: { manual?: boolean }) => {
      await runVerificationCheck(Boolean(options?.manual));
    },
    [runVerificationCheck],
  );

  const { isSubmitting, isLocked, error } = useMemo(() => {
    const submitting = state.phase === "signingUp";
    const locked =
      state.phase === "signingUp" ||
      state.phase === "awaitingVerification" ||
      state.phase === "verifying" ||
      state.phase === "persisting";

    return {
      isSubmitting: submitting,
      isLocked: locked,
      error: state.error,
    };
  }, [state.error, state.phase]);

  return {
    phase: state.phase,
    attemptId: state.attemptId,
    adminUuid: state.adminUuid,
    error,
    result: state.result,
    isSubmitting,
    isLocked,
    payload: state.payload,
    submit,
    confirmVerification,
    reset,
  };
}
