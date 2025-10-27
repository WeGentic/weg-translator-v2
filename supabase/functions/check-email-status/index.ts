import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET,HEAD",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "[check_email_status] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
  );
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
  : null;

let kvInstance: Deno.Kv | null = null;
let kvInitPromise: Promise<Deno.Kv | null> | null = null;

const RATE_LIMIT_MAX_REQUESTS = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_KEY_PREFIX = ["check-email-status", "rate-limit"] as const;

const requestSchema = z.object({
  email: z.string().email("email must be a valid address."),
  attemptId: z.string().uuid().optional(),
});

type EmailStatus =
  | "not_registered"
  | "registered_verified"
  | "registered_unverified";

type RequestPayload = z.infer<typeof requestSchema>;

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId?: string;
}

interface ClassificationResult {
  status: EmailStatus;
  verifiedAt: string | null;
  lastSignInAt: string | null;
}

interface SuccessBody {
  data: ClassificationResult & {
    correlationId: string;
    attemptId?: string;
  };
}

function jsonResponse(
  body: SuccessBody | ErrorBody,
  status = 200,
  correlationId?: string,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = new Headers(CORS_HEADERS);
  if (correlationId) {
    headers.set("x-correlation-id", correlationId);
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function deriveCorrelationId(req: Request, payload?: RequestPayload): string {
  const headerId = req.headers.get("x-correlation-id");
  if (headerId && headerId.trim().length > 0) {
    return headerId.trim();
  }
  if (payload?.attemptId) {
    return payload.attemptId;
  }
  return crypto.randomUUID();
}

interface ClassificationOptions {
  correlationId?: string;
  emailHash?: string;
}

async function classifyEmail(
  email: string,
  client: SupabaseClient | null = supabase,
  options: ClassificationOptions = {},
): Promise<
  | { status: "ok"; data: ClassificationResult }
  | { status: "error"; body: ErrorBody; httpStatus: number }
> {
  if (!client) {
    return {
      status: "error",
      httpStatus: 500,
      body: {
        error: {
          code: "server_config",
          message: "Supabase client is not configured.",
        },
      },
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  type AdminApi = {
    listUsers: (
      params: { page?: number; perPage?: number; filter?: string },
    ) => Promise<{
      data: {
        users: Array<
          {
            email?: string | null;
            email_confirmed_at?: string | null;
            last_sign_in_at?: string | null;
          }
        >;
      } | null;
      error: { code?: string; message?: string } | null;
    }>;
  };

  const adminApi = client.auth.admin as unknown as AdminApi;

  const { data, error } = await adminApi.listUsers({
    page: 1,
    perPage: 2,
    // `auth.admin.listUsers` only accepts a free-text filter. Providing operators such as
    // `email.eq.` triggers 400 responses, so we rely on the substring filter and enforce
    // strict equality locally after fetching results.
    filter: normalizedEmail,
  });

  if (error) {
    console.error(JSON.stringify({
      event: "check_email_status.list_users_error",
      code: error.code,
      message: error.message,
      correlationId: options.correlationId,
      emailHash: options.emailHash,
    }));
    return {
      status: "error",
      httpStatus: 502,
      body: {
        error: {
          code: "supabase_query_failed",
          message: "Failed to query user status.",
          details: { code: error.code, message: error.message },
        },
      },
    };
  }

  const user = data?.users?.find((entry) => {
    const entryEmail = entry.email ?? "";
    return entryEmail.toLowerCase() === normalizedEmail;
  });

  if (!user) {
    return {
      status: "ok",
      data: {
        status: "not_registered",
        verifiedAt: null,
        lastSignInAt: null,
      },
    };
  }

  const verified = Boolean(user.email_confirmed_at);
  return {
    status: "ok",
    data: {
      status: verified ? "registered_verified" : "registered_unverified",
      verifiedAt: user.email_confirmed_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
    },
  };
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
  }

  if (req.method === "HEAD") {
    const correlationId = req.headers.get("x-correlation-id")?.trim() ||
      crypto.randomUUID();
    const headers = new Headers(CORS_HEADERS);
    headers.set("x-correlation-id", correlationId);
    return new Response(null, { status: 200, headers });
  }

  if (req.method === "GET") {
    return jsonResponse(
      {
        data: {
          status: "not_registered",
          verifiedAt: null,
          lastSignInAt: null,
          correlationId: crypto.randomUUID(),
        },
      },
      200,
    );
  }

  if (req.method !== "POST") {
    const correlationId = req.headers.get("x-correlation-id")?.trim() ||
      crypto.randomUUID();
    return jsonResponse(
      {
        error: {
          code: "method_not_allowed",
          message: "Only POST is supported.",
        },
        correlationId,
      },
      405,
      correlationId,
    );
  }

  const headerCorrelation = req.headers.get("x-correlation-id")?.trim() ||
    undefined;

  let payload: RequestPayload;
  try {
    const body = await req.json();
    payload = requestSchema.parse(body);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Invalid request payload."
      : "Request body must be valid JSON.";
    const correlationId = headerCorrelation ?? crypto.randomUUID();
    return jsonResponse(
      {
        error: {
          code: "validation_failed",
          message,
          details: error instanceof z.ZodError ? error.flatten() : undefined,
        },
        correlationId,
      },
      error instanceof z.ZodError ? 422 : 400,
      correlationId,
    );
  }

  const correlationId = deriveCorrelationId(req, payload);

  if (!supabase) {
    return jsonResponse(
      {
        error: {
          code: "server_config",
          message: "Supabase client is not configured.",
        },
        correlationId,
      },
      500,
      correlationId,
    );
  }

  const emailHash = await hashIdentifier(payload.email);
  const clientIp = getClientIp(req);
  const ipHash = clientIp ? await hashIdentifier(clientIp) : null;

  console.info(JSON.stringify({
    event: "check_email_status.received",
    correlationId,
    attemptId: payload.attemptId ?? null,
    emailHash,
    ipHash,
  }));

  let rateLimit: RateLimitOutcome | null = null;
  if (clientIp) {
    rateLimit = await recordRateLimitHit(clientIp);
    if (rateLimit && !rateLimit.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      );
      console.warn(JSON.stringify({
        event: "check_email_status.rate_limited",
        correlationId,
        emailHash,
        ipHash,
        retryAfter,
      }));
      return jsonResponse(
        {
          error: {
            code: "rate_limited",
            message: "Too many requests. Try again later.",
          },
          correlationId,
        },
        429,
        correlationId,
        {
          "Retry-After": retryAfter.toString(),
          "RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString(),
        },
      );
    }
  }

  const result = await classifyEmail(payload.email, supabase, {
    correlationId,
    emailHash,
  });

  if (result.status === "error") {
    console.error(JSON.stringify({
      event: "check_email_status.error",
      correlationId,
      code: result.body.error.code,
      emailHash,
    }));
    return jsonResponse(
      { ...result.body, correlationId },
      result.httpStatus,
      correlationId,
    );
  }

  const responseData: SuccessBody["data"] = {
    ...result.data,
    correlationId,
  };

  if (payload.attemptId) {
    responseData.attemptId = payload.attemptId;
  }

  const rateLimitHeaders = rateLimit
    ? {
      "RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
      "RateLimit-Remaining": Math.max(rateLimit.remaining, 0).toString(),
      "RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString(),
    }
    : undefined;

  console.info(JSON.stringify({
    event: "check_email_status.success",
    correlationId,
    emailHash,
    ipHash,
    status: responseData.status,
    remaining: rateLimit?.remaining ?? null,
  }));

  return jsonResponse(
    { data: responseData },
    200,
    correlationId,
    rateLimitHeaders,
  );
}

async function getKvInstance(): Promise<Deno.Kv | null> {
  if (kvInstance) {
    return kvInstance;
  }
  if (!kvInitPromise) {
    kvInitPromise = (async () => {
      try {
        return await Deno.openKv();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          JSON.stringify({
            event: "check_email_status.kv_unavailable",
            message,
          }),
        );
        return null;
      }
    })();
  }
  kvInstance = await kvInitPromise;
  return kvInstance;
}

function setKvInstanceForTests(instance: Deno.Kv | null) {
  kvInstance = instance;
  kvInitPromise = Promise.resolve(instance);
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first && first.trim().length > 0) {
      return first.trim();
    }
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) {
    return cfConnectingIp.trim();
  }
  return null;
}

interface RateLimitOutcome {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: number;
}

async function recordRateLimitHit(
  ip: string,
): Promise<RateLimitOutcome | null> {
  const kv = await getKvInstance();
  if (!kv) {
    return null;
  }

  const key: Deno.KvKey = [...RATE_LIMIT_KEY_PREFIX, ip];
  const now = Date.now();
  const newResetAt = now + RATE_LIMIT_WINDOW_MS;

  const create = await kv.atomic()
    .check({ key, versionstamp: null })
    .set(key, { count: 1, resetAt: newResetAt }, {
      expireIn: RATE_LIMIT_WINDOW_MS,
    })
    .commit();

  if (create.ok) {
    return {
      allowed: true,
      count: 1,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: newResetAt,
    };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await kv.get<{ count: number; resetAt: number }>(key);

    if (!current.value) {
      continue;
    }

    const expired = current.value.resetAt <= now;
    const nextCount = expired ? 1 : current.value.count + 1;
    const nextResetAt = expired ? newResetAt : current.value.resetAt;
    const expiresIn = Math.max(1, nextResetAt - now);

    const committed = await kv.atomic()
      .check(current)
      .set(key, { count: nextCount, resetAt: nextResetAt }, {
        expireIn: expiresIn,
      })
      .commit();

    if (!committed.ok) {
      continue;
    }

    return {
      allowed: nextCount <= RATE_LIMIT_MAX_REQUESTS,
      count: nextCount,
      remaining: nextCount <= RATE_LIMIT_MAX_REQUESTS
        ? RATE_LIMIT_MAX_REQUESTS - nextCount
        : 0,
      resetAt: nextResetAt,
    };
  }

  return {
    allowed: true,
    count: 1,
    remaining: RATE_LIMIT_MAX_REQUESTS - 1,
    resetAt: newResetAt,
  };
}

async function hashIdentifier(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

if (import.meta.main) {
  serve(handleRequest);
}

export {
  classifyEmail,
  deriveCorrelationId,
  getClientIp,
  handleRequest,
  jsonResponse,
  recordRateLimitHit,
  requestSchema,
  setKvInstanceForTests,
};
