import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import postgres from "https://deno.land/x/postgresjs@v3.4.3/mod.js";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const databaseUrl = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DATABASE_URL");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[register_organization] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

const registrationSchema = z.object({
  attemptId: z.string().uuid().optional(),
  company: z.object({
    name: z.string().min(1, "Company name is required."),
    email: z.string().email("Company email must be valid."),
    phone: z.string().min(1, "Company phone is required."),
    taxId: z.string().min(1, "Tax identifier is required."),
    taxCountryCode: z.string().regex(/^[A-Z]{2}$/, "taxCountryCode must be ISO 3166-1 alpha-2.").optional(),
    address: z.object({
      freeform: z.string().min(1, "A formatted address is required."),
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      countryCode: z.string().regex(/^[A-Z]{2}$/, "address.countryCode must be ISO 3166-1 alpha-2.").optional(),
    }),
  }),
});

type RegistrationInput = z.infer<typeof registrationSchema>;
type ErrorBody = { error: { code: string; message: string; details?: unknown } };
type SuccessBody = { data: { companyId: string; adminUuid: string; correlationId: string } };

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
  if (payload?.attemptId) {
    return payload.attemptId;
  }
  return crypto.randomUUID();
}

interface PgError {
  code?: string;
  detail?: string;
  constraint?: string;
  message?: string;
}

function normalizeDbError(error: unknown): { status: number; body: ErrorBody } {
  const pgErr = error as PgError;
  const code = pgErr?.code;

  if (code === "23505") {
    return {
      status: 409,
      body: {
        error: {
          code: "conflict",
          message:
            "A company or administrator already exists for this account. Contact support if this is unexpected.",
          details: { constraint: pgErr.constraint, detail: pgErr.detail },
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
      },
    },
  };
}

async function handleRegistration(
  payload: RegistrationInput,
  token: string,
  correlationId: string,
): Promise<Response> {
  if (!databaseUrl) {
    console.error("[register_organization] Missing SUPABASE_DB_URL/DATABASE_URL env var.", {
      correlationId,
    });
    return jsonResponse(
      {
        error: {
          code: "server_config",
          message: "Database connection string is not configured.",
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
    return jsonResponse({ error: verification.error }, verification.error.code === "email_not_verified" ? 403 : 401, correlationId);
  }

  const { user } = verification;
  const adminEmail = (user.email ?? payload.company.email).toLowerCase();
  const companyEmail = payload.company.email.toLowerCase();

  if (adminEmail !== companyEmail) {
    return jsonResponse(
      {
        error: {
          code: "email_mismatch",
          message: "Company email must match the authenticated administrator email.",
        },
      },
      422,
      correlationId,
    );
  }

  const sql = postgres(databaseUrl, {
    prepare: true,
    idle_timeout: 10,
  });

  try {
    const result = await sql.begin(async (trx) => {
      const [companyRow] = await trx<{ id: string }>`
        insert into public.companies (
          owner_admin_uuid,
          name,
          email,
          phone,
          tax_id,
          tax_country_code,
          address_freeform,
          address_line1,
          address_line2,
          address_city,
          address_state,
          address_postal_code,
          address_country_code,
          email_verified,
          phone_verified,
          account_approved
        )
        values (
          ${user.id},
          ${payload.company.name},
          ${companyEmail},
          ${payload.company.phone},
          ${payload.company.taxId},
          ${payload.company.taxCountryCode ?? null},
          ${payload.company.address.freeform},
          ${payload.company.address.line1 ?? null},
          ${payload.company.address.line2 ?? null},
          ${payload.company.address.city ?? null},
          ${payload.company.address.state ?? null},
          ${payload.company.address.postalCode ?? null},
          ${payload.company.address.countryCode ?? null},
          ${true},
          ${false},
          ${false}
        )
        returning id;
      `;

      const companyId = companyRow.id;

      await trx`
        insert into public.company_admins (
          admin_uuid,
          company_id,
          admin_email,
          phone,
          email_verified,
          phone_verified,
          account_approved
        )
        values (
          ${user.id},
          ${companyId},
          ${adminEmail},
          null,
          ${true},
          ${false},
          ${false}
        )
        returning admin_uuid;
      `;

      return { companyId };
    });

    console.info("[register_organization] Registration persisted.", {
      correlationId,
      companyId: result.companyId,
    });

    return jsonResponse(
      {
        data: {
          companyId: result.companyId,
          adminUuid: user.id,
          correlationId,
        },
      },
      201,
      correlationId,
    );
  } catch (error) {
    const { status, body } = normalizeDbError(error);
    console.error("[register_organization] Database operation failed.", {
      correlationId,
      status,
      code: (error as PgError)?.code,
      detail: (error as PgError)?.detail,
    });
    return jsonResponse(body, status, correlationId);
  } finally {
    await sql.end({ timeout: 1 });
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
