import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[register_organization] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

const registrationSchema = z.object({
  correlationId: z.string().uuid().optional(),
  company_name: z.string().min(1, "Company name is required."),
  company_email: z.string().email("Company email must be valid."),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
});

type RegistrationInput = z.infer<typeof registrationSchema>;
type ErrorBody = { error: { code: string; message: string; details?: unknown; correlationId?: string } };
type SuccessBody = { success: true; account_uuid: string; user_uuid: string; subscription_uuid: string; correlationId: string };

function jsonResponse(
  body: SuccessBody | ErrorBody | Record<string, unknown>,
  status = 200,
  correlationId?: string,
): Response {
  const headers = new Headers(CORS_HEADERS);
  if (correlationId) {
    headers.set("x-correlation-id", correlationId);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function getVerifiedUser(token: string) {
  if (!supabase) {
    return { error: { code: "server_config", message: "Supabase client unavailable" } } as const;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      error: {
        code: "invalid_token",
        message: "Authorization token is invalid or expired.",
      },
    } as const;
  }

  const user = data.user;
  if (!user.email_confirmed_at) {
    return {
      error: {
        code: "email_not_verified",
        message: "Email address must be verified before completing registration.",
      },
    } as const;
  }

  return { user };
}

function deriveCorrelationId(req: Request, payload?: RegistrationInput): string {
  const headerId = req.headers.get("x-correlation-id");
  if (headerId && headerId.trim().length) {
    return headerId.trim();
  }
  if (payload?.correlationId) {
    return payload.correlationId;
  }
  return crypto.randomUUID();
}

interface PgError {
  code?: string;
  detail?: string;
  constraint?: string;
  message?: string;
}

function normalizeDbError(error: unknown, correlationId: string): { status: number; body: ErrorBody } {
  const pgErr = error as PgError;
  const code = pgErr?.code;

  if (code === "23505") {
    return {
      status: 409,
      body: {
        error: {
          code: "EMAIL_EXISTS",
          message: "This email is already registered. Please login or use a different email.",
          details: { constraint: pgErr.constraint, detail: pgErr.detail },
          correlationId,
        },
      },
    };
  }

  if (code === "23503" || code === "23514") {
    return {
      status: 422,
      body: {
        error: {
          code: "invalid_reference",
          message: "Submitted data violates database constraints.",
          details: { constraint: pgErr.constraint, detail: pgErr.detail },
          correlationId,
        },
      },
    };
  }

  if (code === "40001" || code === "40P01") {
    return {
      status: 503,
      body: {
        error: {
          code: "retry_required",
          message: "Database contention detected. Please retry the registration.",
          correlationId,
        },
      },
    };
  }

  // Database timeout errors
  if (code === "57014" || code === "57P01") {
    return {
      status: 500,
      body: {
        error: {
          code: "database_timeout",
          message: "Registration request timed out. Please try again.",
          correlationId,
        },
      },
    };
  }

  const message =
    pgErr?.message && pgErr.message.trim().length > 0
      ? pgErr.message
      : "Unexpected server error.";

  return {
    status: 500,
    body: {
      error: {
        code: "unhandled_error",
        message,
        details: { detail: pgErr?.detail, constraint: pgErr?.constraint },
        correlationId,
      },
    },
  };
}

async function handleRegistration(
  payload: RegistrationInput,
  token: string,
  correlationId: string,
): Promise<Response> {
  if (!supabase) {
    console.error("[register_organization] Supabase client unavailable.", {
      correlationId,
    });
    return jsonResponse(
      {
        error: {
          code: "server_config",
          message: "Supabase client is not configured.",
          correlationId,
        },
      },
      500,
      correlationId,
    );
  }

  const verification = await getVerifiedUser(token);
  if ("error" in verification) {
    console.warn("[register_organization] User verification failed.", {
      correlationId,
      code: verification.error.code,
    });

    // Map email_not_verified to 401 with specific message
    if (verification.error.code === "email_not_verified") {
      return jsonResponse(
        {
          error: {
            ...verification.error,
            message: "Email verification required before account creation.",
            correlationId,
          }
        },
        401,
        correlationId
      );
    }

    return jsonResponse(
      { error: { ...verification.error, correlationId } },
      401,
      correlationId
    );
  }

  const { user } = verification;

  try {
    // Invoke create_account_with_admin database function
    const { data, error } = await supabase.rpc("create_account_with_admin", {
      p_company_name: payload.company_name,
      p_company_email: payload.company_email.toLowerCase(),
      p_admin_first_name: payload.first_name || null,
      p_admin_last_name: payload.last_name || null,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("create_account_with_admin returned no data");
    }

    console.info("[register_organization] Account created successfully.", {
      correlationId,
      account_uuid: data.account_uuid,
      user_uuid: data.user_uuid,
      subscription_uuid: data.subscription_uuid,
    });

    return jsonResponse(
      {
        success: true,
        account_uuid: data.account_uuid,
        user_uuid: data.user_uuid,
        subscription_uuid: data.subscription_uuid,
        correlationId,
      },
      201,
      correlationId,
    );
  } catch (error) {
    const { status, body } = normalizeDbError(error, correlationId);
    console.error("[register_organization] Account creation failed.", {
      correlationId,
      status,
      error: error instanceof Error ? error.message : String(error),
      code: (error as PgError)?.code,
      detail: (error as PgError)?.detail,
    });
    return jsonResponse(body, status, correlationId);
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === "GET") {
    return jsonResponse({ status: "ok" }, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: {
          code: "method_not_allowed",
          message: "Only POST is supported.",
        },
      },
      405,
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(
      {
        error: {
          code: "missing_token",
          message: "Authorization header with Bearer token is required.",
        },
      },
      401,
    );
  }

  let payload: RegistrationInput;
  try {
    const raw = await req.json();
    const result = registrationSchema.safeParse(raw);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return jsonResponse(
        {
          error: {
            code: "validation_failed",
            message: "Submitted data is invalid.",
            details,
          },
        },
        422,
      );
    }
    payload = result.data;
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: "invalid_json",
          message: error instanceof Error ? error.message : "Request body must be valid JSON.",
        },
      },
      400,
    );
  }

  const correlationId = deriveCorrelationId(req, payload);
  const token = authHeader.slice("Bearer ".length).trim();

  return handleRegistration(payload, token, correlationId);
}

if (import.meta.main) {
  serve(handleRequest);
}
