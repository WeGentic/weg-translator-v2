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

function createMockClient(
  response: ListUsersResponse,
  spy?: (params: ListUsersParams) => void,
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

Deno.test("classifyEmail returns registered_verified when user is confirmed", async () => {
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
});

Deno.test("classifyEmail returns registered_unverified when email not confirmed", async () => {
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
