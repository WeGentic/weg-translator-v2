import { assertEquals } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import {
  classifyEmail,
  deriveCorrelationId,
  getClientIp,
  jsonResponse,
  recordRateLimitHit,
  setKvInstanceForTests,
} from "./index.ts";

interface MockUser {
  id?: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}

interface ListUsersResponse {
  data: { users: MockUser[] } | null;
  error: { code?: string; message?: string } | null;
}

interface ListUsersParams {
  page?: number;
  perPage?: number;
  filter?: string;
}

interface MockAtomicOperation {
  check: (
    entry: { key: unknown; versionstamp: string | null },
  ) => MockAtomicOperation;
  set: (
    key: unknown,
    value: unknown,
    options?: { expireIn?: number },
  ) => MockAtomicOperation;
  commit: () => Promise<{ ok: boolean }>;
}

interface MockKv {
  atomic: () => MockAtomicOperation;
  get: (
    key: unknown,
  ) => Promise<{ key: unknown; value: unknown; versionstamp: string | null }>;
}

interface CompanyQueryResponse {
  data: { id: string } | null;
  error: { code?: string; message?: string } | null;
}

function createMockClient(
  response: ListUsersResponse,
  spy?: (params: ListUsersParams) => void,
  companyQueryResponse?: CompanyQueryResponse | Promise<CompanyQueryResponse>,
): SupabaseClient {
  const mock = {
    auth: {
      admin: {
        async listUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
          spy?.(params);
          return response;
        },
      },
    },
    from: (table: string) => {
      if (table === 'companies') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                single: async () => {
                  if (companyQueryResponse instanceof Promise) {
                    return await companyQueryResponse;
                  }
                  return companyQueryResponse || { data: null, error: { code: 'PGRST116', message: 'No rows' } };
                }
              })
            })
          })
        };
      }
      return {};
    }
  };
  return mock as unknown as SupabaseClient;
}

function createMockKv(): MockKv {
  const store = new Map<
    string,
    { value: unknown; versionstamp: string | null; expireAt: number | null }
  >();
  let counter = 0;

  const now = () => Date.now();

  return {
    async get(key) {
      const serialized = JSON.stringify(key);
      const entry = store.get(serialized);
      if (!entry) {
        return { key, value: null, versionstamp: null };
      }
      if (entry.expireAt !== null && entry.expireAt <= now()) {
        store.delete(serialized);
        return { key, value: null, versionstamp: null };
      }
      return { key, value: entry.value, versionstamp: entry.versionstamp };
    },
    atomic() {
      const checks: Array<{ serialized: string; versionstamp: string | null }> =
        [];
      let setArgs:
        | { serialized: string; value: unknown; expireIn?: number }
        | null = null;

      const api: MockAtomicOperation = {
        check(entry) {
          checks.push({
            serialized: JSON.stringify(entry.key),
            versionstamp: entry.versionstamp,
          });
          return api;
        },
        set(key, value, options) {
          setArgs = {
            serialized: JSON.stringify(key),
            value,
            expireIn: options?.expireIn,
          };
          return api;
        },
        async commit() {
          const currentTime = now();
          for (const check of checks) {
            const existing = store.get(check.serialized);
            const currentVersion = existing?.versionstamp ?? null;
            if (currentVersion !== check.versionstamp) {
              return { ok: false };
            }
          }
          if (setArgs) {
            counter += 1;
            const expireAt = setArgs.expireIn
              ? currentTime + setArgs.expireIn
              : null;
            store.set(setArgs.serialized, {
              value: setArgs.value,
              versionstamp: `vs-${counter}`,
              expireAt,
            });
          }
          return { ok: true };
        },
      };

      return api;
    },
  };
}

Deno.test("getClientIp parses x-forwarded-for header", () => {
  const req = new Request("https://example.com", {
    headers: {
      "x-forwarded-for": "203.0.113.1, 10.0.0.1",
    },
  });
  assertEquals(getClientIp(req), "203.0.113.1");
});

Deno.test("getClientIp falls back to x-real-ip header", () => {
  const req = new Request("https://example.com", {
    headers: {
      "x-real-ip": "198.51.100.7",
    },
  });
  assertEquals(getClientIp(req), "198.51.100.7");
});

Deno.test("deriveCorrelationId prioritizes existing header", () => {
  const request = new Request("https://example.com", {
    headers: {
      "x-correlation-id": "header-id",
      "content-type": "application/json",
    },
  });
  const id = deriveCorrelationId(request, { email: "a@example.com" });
  assertEquals(id, "header-id");
});

Deno.test("deriveCorrelationId falls back to attemptId when header missing", () => {
  const request = new Request("https://example.com", {
    headers: { "content-type": "application/json" },
  });
  const id = deriveCorrelationId(request, {
    email: "a@example.com",
    attemptId: "1d05b611-6047-4cc8-8d1a-52cd94c2d878",
  });
  assertEquals(id, "1d05b611-6047-4cc8-8d1a-52cd94c2d878");
});

Deno.test("classifyEmail returns not_registered when no user found", async () => {
  const client = createMockClient({ data: { users: [] }, error: null });
  const result = await classifyEmail("fresh@example.com", client);
  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }
  assertEquals(result.data.status, "not_registered");
  assertEquals(result.data.verifiedAt, null);
  assertEquals(result.data.lastSignInAt, null);
});

Deno.test({
  name: "classifyEmail returns registered_verified when user is confirmed",
  sanitizeResources: false,
  async fn() {
  const client = createMockClient({
    data: {
      users: [{
        email: "existing@example.com",
        email_confirmed_at: "2024-12-01T12:30:00Z",
        last_sign_in_at: "2025-01-02T10:00:00Z",
      }],
    },
    error: null,
  });
  const result = await classifyEmail("existing@example.com", client);
  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }
  assertEquals(result.data.status, "registered_verified");
  assertEquals(result.data.verifiedAt, "2024-12-01T12:30:00Z");
  assertEquals(result.data.lastSignInAt, "2025-01-02T10:00:00Z");
  }
});

Deno.test({
  name: "classifyEmail returns registered_unverified when email not confirmed",
  sanitizeResources: false,
  async fn() {
  const client = createMockClient({
    data: {
      users: [{
        email: "pending@example.com",
        email_confirmed_at: null,
        last_sign_in_at: null,
      }],
    },
    error: null,
  });
  const result = await classifyEmail("pending@example.com", client);
  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }
  assertEquals(result.data.status, "registered_unverified");
  }
});

Deno.test("classifyEmail queries Supabase with normalized substring filter", async () => {
  let observed: ListUsersParams | undefined;
  const client = createMockClient({ data: { users: [] }, error: null }, (params) => {
    observed = params;
  });
  await classifyEmail("User@Example.com", client);
  assertEquals(observed?.page, 1);
  assertEquals(observed?.perPage, 2);
  assertEquals(observed?.filter, "user@example.com");
});

Deno.test("classifyEmail handles Supabase admin errors", async () => {
  const client = createMockClient({
    data: null,
    error: { code: "500", message: "boom" },
  });
  const result = await classifyEmail("oops@example.com", client);
  assertEquals(result.status, "error");
  if (result.status === "error") {
    assertEquals(result.httpStatus, 502);
    assertEquals(result.body.error.code, "supabase_query_failed");
  }
});

Deno.test("classifyEmail returns server_config error when client missing", async () => {
  const result = await classifyEmail("missing@example.com", null);
  assertEquals(result.status, "error");
  if (result.status === "error") {
    assertEquals(result.httpStatus, 500);
    assertEquals(result.body.error.code, "server_config");
  }
});

Deno.test("jsonResponse applies correlation id header when provided", async () => {
  const response = jsonResponse(
    {
      data: {
        status: "not_registered",
        verifiedAt: null,
        lastSignInAt: null,
        correlationId: "abc",
      },
    },
    200,
    "abc",
  );
  assertEquals(response.headers.get("x-correlation-id"), "abc");
  const body = await response.json();
  assertEquals(body.data.correlationId, "abc");
});

Deno.test("recordRateLimitHit enforces windowed limits", async () => {
  setKvInstanceForTests(createMockKv() as unknown as Deno.Kv);
  let outcome = await recordRateLimitHit("203.0.113.5");
  if (!outcome) {
    throw new Error("Expected rate limit metadata");
  }
  assertEquals(outcome.allowed, true);
  assertEquals(outcome.count, 1);

  for (let i = 0; i < 10; i++) {
    outcome = (await recordRateLimitHit("203.0.113.5")) ?? outcome;
  }

  outcome = await recordRateLimitHit("203.0.113.5");
  if (!outcome) {
    throw new Error("Expected rate limit metadata");
  }
  assertEquals(outcome.allowed, true);
  assertEquals(outcome.remaining, 0);

  const blocked = await recordRateLimitHit("203.0.113.5");
  if (!blocked) {
    throw new Error("Expected rate limit metadata");
  }
  assertEquals(blocked.allowed, false);
  setKvInstanceForTests(null);
});

// ============================================================================
// PHASE 2 ENHANCEMENT TESTS: Orphan State Detection
// ============================================================================

Deno.test({
  name: "classifyEmail: Case 1.1 - registered_unverified with no company data returns isOrphaned=true",
  sanitizeResources: false, // Ignore timer leaks from 100ms timeout in code
  async fn() {
  const client = createMockClient(
    {
      data: {
        users: [{
          id: "test-user-id-111",
          email: "orphan-unverified@example.com",
          email_confirmed_at: null, // Unverified
          last_sign_in_at: null,
        }],
      },
      error: null,
    },
    undefined,
    { data: null, error: { code: 'PGRST116', message: 'No rows' } } // No company data
  );

  const result = await classifyEmail("orphan-unverified@example.com", client);

  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }

  assertEquals(result.data.status, "registered_unverified");
  assertEquals(result.data.hasCompanyData, false);
  assertEquals(result.data.isOrphaned, true);
  }
});

Deno.test({
  name: "classifyEmail: Case 1.2 - registered_verified with no company data returns isOrphaned=true",
  sanitizeResources: false,
  async fn() {
  const client = createMockClient(
    {
      data: {
        users: [{
          id: "test-user-id-112",
          email: "orphan-verified@example.com",
          email_confirmed_at: "2025-01-15T10:00:00Z", // Verified
          last_sign_in_at: "2025-01-15T10:05:00Z",
        }],
      },
      error: null,
    },
    undefined,
    { data: null, error: { code: 'PGRST116', message: 'No rows' } } // No company data
  );

  const result = await classifyEmail("orphan-verified@example.com", client);

  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }

  assertEquals(result.data.status, "registered_verified");
  assertEquals(result.data.verifiedAt, "2025-01-15T10:00:00Z");
  assertEquals(result.data.hasCompanyData, false);
  assertEquals(result.data.isOrphaned, true);
  }
});

Deno.test({
  name: "classifyEmail: Fully registered user - registered_verified with company data returns isOrphaned=false",
  sanitizeResources: false,
  async fn() {
  const client = createMockClient(
    {
      data: {
        users: [{
          id: "test-user-id-complete",
          email: "complete@example.com",
          email_confirmed_at: "2025-01-10T09:00:00Z", // Verified
          last_sign_in_at: "2025-01-20T14:30:00Z",
        }],
      },
      error: null,
    },
    undefined,
    { data: { id: "company-123" }, error: null } // Has company data
  );

  const result = await classifyEmail("complete@example.com", client);

  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }

  assertEquals(result.data.status, "registered_verified");
  assertEquals(result.data.verifiedAt, "2025-01-10T09:00:00Z");
  assertEquals(result.data.hasCompanyData, true);
  assertEquals(result.data.isOrphaned, false);
  }
});

Deno.test({
  name: "classifyEmail: Database query timeout returns null values gracefully",
  sanitizeResources: false,
  async fn() {
  // Simulate a timeout by creating a promise that takes longer than 100ms
  const timeoutPromise = new Promise<CompanyQueryResponse>((resolve) => {
    setTimeout(() => {
      resolve({ data: null, error: new Error('Query timeout') as any });
    }, 150);
  });

  const client = createMockClient(
    {
      data: {
        users: [{
          id: "test-user-timeout",
          email: "timeout@example.com",
          email_confirmed_at: "2025-01-15T10:00:00Z",
          last_sign_in_at: null,
        }],
      },
      error: null,
    },
    undefined,
    timeoutPromise
  );

  const result = await classifyEmail("timeout@example.com", client);

  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }

  assertEquals(result.data.status, "registered_verified");
  assertEquals(result.data.hasCompanyData, null); // Graceful degradation
  assertEquals(result.data.isOrphaned, null); // Cannot determine orphan state
  }
});

Deno.test({
  name: "classifyEmail: Database query error returns null values for graceful degradation",
  sanitizeResources: false,
  async fn() {
  const client = createMockClient(
    {
      data: {
        users: [{
          id: "test-user-error",
          email: "error@example.com",
          email_confirmed_at: "2025-01-15T10:00:00Z",
          last_sign_in_at: null,
        }],
      },
      error: null,
    },
    undefined,
    { data: null, error: { code: 'INTERNAL_ERROR', message: 'Database connection failed' } }
  );

  const result = await classifyEmail("error@example.com", client);

  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }

  assertEquals(result.data.status, "registered_verified");
  assertEquals(result.data.hasCompanyData, null); // Graceful degradation
  assertEquals(result.data.isOrphaned, null); // Cannot determine orphan state
  }
});

Deno.test({
  name: "classifyEmail: Backward compatibility - existing fields remain unchanged",
  sanitizeResources: false,
  async fn() {
  const client = createMockClient(
    {
      data: {
        users: [{
          id: "test-user-backward",
          email: "backward@example.com",
          email_confirmed_at: "2025-01-01T00:00:00Z",
          last_sign_in_at: "2025-01-15T12:00:00Z",
        }],
      },
      error: null,
    },
    undefined,
    { data: { id: "company-456" }, error: null }
  );

  const result = await classifyEmail("backward@example.com", client);

  if (result.status !== "ok") {
    throw new Error("Expected ok result");
  }

  // Verify all original fields are present and correct
  assertEquals(result.data.status, "registered_verified");
  assertEquals(result.data.verifiedAt, "2025-01-01T00:00:00Z");
  assertEquals(result.data.lastSignInAt, "2025-01-15T12:00:00Z");

  // Verify new fields don't break existing behavior
  assertEquals(result.data.hasCompanyData, true);
  assertEquals(result.data.isOrphaned, false);
  }
});
