import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../request", () => ({
  safeInvoke: vi.fn(),
}));

import { updateProjectBundle } from "../projects";
import { updateUserProfile } from "../users";
import { updateClientRecord } from "../clients";
import { safeInvoke } from "../../request";

const mockSafeInvoke = vi.mocked(safeInvoke);

const getPayload = () => {
  const call = mockSafeInvoke.mock.calls.at(-1);
  if (!call) {
    throw new Error("safeInvoke was not called");
  }
  const [, args] = call as [string, { payload: Record<string, unknown> }];
  return args.payload;
};

describe("ipc/db null forwarding", () => {
  beforeEach(() => {
    mockSafeInvoke.mockReset();
  });

  it("forwards explicit nulls when updating a project", async () => {
    mockSafeInvoke.mockResolvedValueOnce(null);

    await updateProjectBundle({
      projectUuid: "proj-null-reset",
      notes: null,
      clientUuid: null,
    });

    const payload = getPayload();
    expect(payload).toMatchObject({
      projectUuid: "proj-null-reset",
      notes: null,
      clientUuid: null,
    });
    expect(Object.prototype.hasOwnProperty.call(payload, "notes")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload, "clientUuid")).toBe(true);
  });

  it("omits undefined optional fields for project updates", async () => {
    mockSafeInvoke.mockResolvedValueOnce(null);

    await updateProjectBundle({
      projectUuid: "proj-omit",
    });

    const payload = getPayload();
    expect(payload).toEqual({ projectUuid: "proj-omit" });
  });

  it("forwards explicit nulls when updating a user profile", async () => {
    mockSafeInvoke.mockResolvedValueOnce(null);

    await updateUserProfile({
      userUuid: "user-null",
      phone: null,
      address: null,
    });

    const payload = getPayload();
    expect(payload).toMatchObject({
      userUuid: "user-null",
      phone: null,
      address: null,
    });
    expect(Object.prototype.hasOwnProperty.call(payload, "phone")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload, "address")).toBe(true);
  });

  it("forwards explicit nulls when updating a client record", async () => {
    mockSafeInvoke.mockResolvedValueOnce(null);

    await updateClientRecord({
      clientUuid: "client-null",
      email: null,
      note: null,
    });

    const payload = getPayload();
    expect(payload).toMatchObject({
      clientUuid: "client-null",
      email: null,
      note: null,
    });
    expect(Object.prototype.hasOwnProperty.call(payload, "email")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload, "note")).toBe(true);
  });
});
