import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from "react";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import validator from "validator";

import { supabase, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY } from "@/core/config";
import { logger } from "@/core/logging";
import { useToast } from "@/shared/ui/toast";

type EmailProbeClassification =
  | "not_registered"
  | "registered_verified"
  | "registered_unverified";

interface EmailProbeResult {
  status: EmailProbeClassification;
  verifiedAt: string | null;
  lastSignInAt: string | null;
  correlationId: string;
  attemptId?: string;
  checkedAt: number;
  // NEW FIELDS from enhanced check-email-status edge function (Phase 2)
  hasCompanyData: boolean | null;
  isOrphaned: boolean | null;
}

interface EmailProbeError {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  correlationId?: string;
}

interface EmailProbeState {
  phase: "idle" | "checking" | "ready" | "error";
  result: EmailProbeResult | null;
  error: EmailProbeError | null;
  lastCheckedEmail: string | null;
}

type EmailProbeAction =
  | { type: "reset" }
  | { type: "checking"; email: string }
  | { type: "resolved"; email: string; result: EmailProbeResult }
  | { type: "errored"; email: string; error: EmailProbeError };

interface UseEmailStatusProbeOptions {
  email: string | null | undefined;
  attemptId?: string | null;
  enabled?: boolean;
  debounceMs?: number;
}

export interface EmailStatusProbeApi {
  status: EmailProbeClassification | "idle";
  result: EmailProbeResult | null;
  isLoading: boolean;
  error: EmailProbeError | null;
  lastCheckedEmail: string | null;
  reset: () => void;
  forceCheck: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

const INITIAL_STATE: EmailProbeState = {
  phase: "idle",
  result: null,
  error: null,
  lastCheckedEmail: null,
};

const DEFAULT_DEBOUNCE_MS = 450;
const CACHE_TTL_MS = 2 * 60_000;

interface CacheEntry {
  result: EmailProbeResult;
  timestamp: number;
}

function probeReducer(state: EmailProbeState, action: EmailProbeAction): EmailProbeState {
  switch (action.type) {
    case "reset":
      return INITIAL_STATE;
    case "checking":
      return {
        ...state,
        phase: "checking",
        error: null,
        lastCheckedEmail: action.email,
      };
    case "resolved":
      return {
        phase: "ready",
        result: action.result,
        error: null,
        lastCheckedEmail: action.email,
      };
    case "errored":
      return {
        phase: "error",
        result: state.result,
        error: action.error,
        lastCheckedEmail: action.email,
      };
    default:
      return state;
  }
}

function extractErrorPayload(fetchError: unknown): EmailProbeError {
  if (fetchError instanceof FunctionsHttpError || fetchError instanceof FunctionsRelayError) {
    return {
      code: fetchError.name ?? "edge_function_error",
      message: fetchError.message ?? "Email status check failed.",
    };
  }

  if (fetchError instanceof FunctionsFetchError) {
    return {
      code: fetchError.name ?? "network_error",
      message: fetchError.message ?? "Network error while checking email status.",
    };
  }

  if (fetchError instanceof Error) {
    return {
      code: fetchError.name || "unknown_error",
      message: fetchError.message || "Unexpected error while checking email status.",
    };
  }

  return {
    code: "unknown_error",
    message: "Unexpected error while checking email status.",
  };
}

async function parseErrorResponse(
  response: Response | undefined,
): Promise<Partial<EmailProbeError>> {
  if (!response) {
    return {};
  }

  try {
    const payload = await response.clone().json();
    if (payload?.error) {
      return {
        code: typeof payload.error.code === "string" ? payload.error.code : undefined,
        message: typeof payload.error.message === "string"
          ? payload.error.message
          : undefined,
        correlationId: payload.correlationId
          ? String(payload.correlationId)
          : undefined,
      };
    }
  } catch {
    // ignore parse failure
  }

  return {};
}

async function hashIdentifier(candidate: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(candidate));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function useEmailStatusProbe({
  email,
  attemptId,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseEmailStatusProbeOptions): EmailStatusProbeApi {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(probeReducer, INITIAL_STATE);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const requestIdRef = useRef(0);
  const latestArgsRef = useRef<{ email: string | null; attemptId: string | null }>({
    email: null,
    attemptId: attemptId ?? null,
  });

  latestArgsRef.current = {
    email: email ? email.trim().toLowerCase() : null,
    attemptId: attemptId ?? null,
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  const scheduleReset = useEffectEvent(() => {
    abortRef.current?.abort();
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: "reset" });
  });

  const executeProbe = useEffectEvent(
    async (normalizedEmail: string, options?: { bypassCache?: boolean }) => {
      const cacheKey = normalizedEmail;
      const now = Date.now();

      if (!options?.bypassCache) {
        const cached = cacheRef.current.get(cacheKey);
        if (cached && now - cached.timestamp < CACHE_TTL_MS) {
          dispatch({ type: "resolved", email: cacheKey, result: cached.result });
          return;
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "checking", email: cacheKey });

      const currentRequestId = ++requestIdRef.current;
      const resolvedAttemptId = latestArgsRef.current.attemptId;
      const correlationId = resolvedAttemptId ?? crypto.randomUUID();
      const emailFingerprint = await hashIdentifier(cacheKey);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token ?? VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

      void logger.debug("registration.email_probe.start", {
        correlation_id: correlationId,
        attempt_id: resolvedAttemptId ?? "<none>",
        email_hash: emailFingerprint,
      });

      try {
        const { data, error, response } = await supabase.functions.invoke(
          "check-email-status",
          {
            body: {
              email: cacheKey,
              attemptId: resolvedAttemptId ?? undefined,
            },
            headers: {
              "x-correlation-id": correlationId,
              Authorization: `Bearer ${accessToken}`,
              apikey: VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
            },
            signal: controller.signal,
          },
        );

        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        if (error) {
          const baseError = extractErrorPayload(error);
          const parsed = await parseErrorResponse(response);
          const retryAfterHeader = response?.headers.get("Retry-After");
          const retryAfterSeconds = retryAfterHeader
            ? Number.parseInt(retryAfterHeader, 10)
            : undefined;
          const merged: EmailProbeError = {
            code: parsed.code ?? baseError.code,
            message: parsed.message ?? baseError.message,
            correlationId: parsed.correlationId ?? correlationId,
            retryAfterSeconds: Number.isFinite(retryAfterSeconds)
              ? Number(retryAfterSeconds)
              : undefined,
          };

          dispatch({ type: "errored", email: cacheKey, error: merged });
          void logger.warn("registration.email_probe.error", {
            correlation_id: merged.correlationId ?? correlationId,
            attempt_id: resolvedAttemptId ?? "<none>",
            email_hash: emailFingerprint,
            error_code: merged.code,
          });
          toast({
            variant: "destructive",
            title: "Email status check failed",
            description: merged.message,
          });
          return;
        }

        const payload = (data as {
          data?: {
            status: EmailProbeClassification;
            verifiedAt?: string | null;
            lastSignInAt?: string | null;
            correlationId?: string;
            attemptId?: string;
            // NEW FIELDS from enhanced check-email-status edge function (Phase 2)
            hasCompanyData?: boolean | null;
            isOrphaned?: boolean | null;
          };
        })?.data;

        if (!payload) {
          const fallbackError: EmailProbeError = {
            code: "invalid_response",
            message: "Email status probe returned an unexpected response.",
            correlationId,
          };
          dispatch({ type: "errored", email: cacheKey, error: fallbackError });
          void logger.warn("registration.email_probe.invalid_response", {
            correlation_id: correlationId,
            attempt_id: resolvedAttemptId ?? "<none>",
            email_hash: emailFingerprint,
          });
          toast({
            variant: "destructive",
            title: "Email status unavailable",
            description: "We could not determine the account status. Try again shortly.",
          });
          return;
        }

        const result: EmailProbeResult = {
          status: payload.status,
          verifiedAt: payload.verifiedAt ?? null,
          lastSignInAt: payload.lastSignInAt ?? null,
          attemptId: payload.attemptId ?? resolvedAttemptId ?? undefined,
          correlationId: payload.correlationId ?? correlationId,
          checkedAt: now,
          // NEW FIELDS from enhanced check-email-status edge function (Phase 2)
          hasCompanyData: payload.hasCompanyData ?? null,
          isOrphaned: payload.isOrphaned ?? null,
        };

        cacheRef.current.set(cacheKey, { result, timestamp: now });
        dispatch({ type: "resolved", email: cacheKey, result });

        void logger.info("registration.email_probe.success", {
          correlation_id: result.correlationId,
          attempt_id: result.attemptId ?? "<none>",
          email_hash: emailFingerprint,
          status: result.status,
        });
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") {
          return;
        }

        const derived = extractErrorPayload(cause);
        const merged: EmailProbeError = {
          code: derived.code,
          message: derived.message,
          correlationId,
        };

        dispatch({ type: "errored", email: cacheKey, error: merged });
        void logger.error(
          "registration.email_probe.exception",
          cause,
          {
            correlation_id: correlationId,
            attempt_id: resolvedAttemptId ?? "<none>",
            email_hash: emailFingerprint,
          },
        );
        toast({
          variant: "destructive",
          title: "Email status check failed",
          description: merged.message,
        });
      }
    },
  );

  useEffect(() => {
    if (!enabled) {
      scheduleReset();
      return;
    }

    const normalizedEmail = email?.trim().toLowerCase() ?? "";
    if (!normalizedEmail.length) {
      scheduleReset();
      return;
    }

    if (!validator.isEmail(normalizedEmail)) {
      scheduleReset();
      return;
    }

    if (
      state.phase === "error" &&
      state.lastCheckedEmail === normalizedEmail
    ) {
      // Prevent tight retry loops on persistent errors (e.g., missing Edge Function deployment).
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      void executeProbe(normalizedEmail);
    }, Math.max(0, debounceMs));

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    debounceMs,
    email,
    enabled,
    executeProbe,
    scheduleReset,
    state.lastCheckedEmail,
    state.phase,
  ]);

  const reset = useEffectEvent(() => {
    scheduleReset();
  });

  const forceCheck = useEffectEvent(async () => {
    const normalizedEmail = latestArgsRef.current.email;
    if (!normalizedEmail) {
      return;
    }
    await executeProbe(normalizedEmail, { bypassCache: true });
  });

  const resendVerification = useEffectEvent(async () => {
    const normalizedEmail = latestArgsRef.current.email;
    if (!normalizedEmail || state.result?.status !== "registered_unverified") {
      toast({
        title: "Verification status unchanged",
        description: "Update the email or try checking the status again first.",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });

      if (error) {
        throw error;
      }

      const correlationId = state.result?.correlationId ?? null;
      const attemptIdentifier = state.result?.attemptId ?? latestArgsRef.current.attemptId ?? null;
      void logger.info("registration.email_probe.resend_verification", {
        email_hash: await hashIdentifier(normalizedEmail),
        correlation_id: correlationId ?? "<none>",
        attempt_id: attemptIdentifier ?? "<none>",
      });
      toast({
        title: "Verification email sent",
        description: "Check your inbox for the confirmation link.",
      });
    } catch (error) {
      const correlationId = state.result?.correlationId ?? null;
      const attemptIdentifier = state.result?.attemptId ?? latestArgsRef.current.attemptId ?? null;
      void logger.error(
        "registration.email_probe.resend_verification_failed",
        error,
        {
          email_hash: await hashIdentifier(normalizedEmail),
          correlation_id: correlationId ?? "<none>",
          attempt_id: attemptIdentifier ?? "<none>",
        },
      );
      toast({
        variant: "destructive",
        title: "Resend failed",
        description: error instanceof Error
          ? error.message
          : "Unable to resend the verification email.",
      });
    }
  });

  return useMemo<EmailStatusProbeApi>(() => {
    const classification = state.result?.status ?? "idle";
    return {
      status: classification,
      result: state.result,
      isLoading: state.phase === "checking",
      error: state.error,
      lastCheckedEmail: state.lastCheckedEmail,
      reset: () => reset(),
      forceCheck: () => forceCheck(),
      resendVerification: () => resendVerification(),
    };
  }, [forceCheck, resendVerification, reset, state]);
}
