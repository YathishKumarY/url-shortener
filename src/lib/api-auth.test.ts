import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateApiKey,
  getRequestUser,
  hashApiKey,
  requireAdmin,
  requireUser,
} from "@/lib/api-auth";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  apiKeyFindUnique: vi.fn(),
  apiKeyUpdate: vi.fn(),
  userFindUnique: vi.fn(),
}));

// Keep next-auth and the database out of the test.
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: { findUnique: mocks.apiKeyFindUnique, update: mocks.apiKeyUpdate },
    user: { findUnique: mocks.userFindUnique },
  },
}));

const NOW = new Date("2026-11-06T12:00:00.000Z");
const KEY = `lk_${"A1b2C3d4".repeat(4)}`;
const OWNER = {
  id: "user_1",
  email: "owner@example.com",
  name: "Owner",
  role: "USER",
  bannedAt: null,
};

function withBearer(value: string): Request {
  return new Request("https://lnk.example/api/v1/links", { headers: { authorization: value } });
}

function apiKeyRow(overrides: Record<string, unknown> = {}) {
  return { id: "key_1", expiresAt: null, lastUsedAt: null, user: OWNER, ...overrides };
}

beforeEach(() => {
  // Only the clock is faked: response bodies are read below and must not wait on timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.apiKeyUpdate.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateApiKey", () => {
  it("returns an lk_ key with 32 base62 characters", () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^lk_[0-9A-Za-z]{32}$/);
    expect(key).toHaveLength(35);
  });

  it("uses the first 10 characters as the display prefix", () => {
    const { key, prefix } = generateApiKey();
    expect(prefix).toBe(key.slice(0, 10));
    expect(prefix.startsWith("lk_")).toBe(true);
  });

  it("stores only the SHA-256 hex digest of the key", () => {
    const { key, hashedKey } = generateApiKey();
    expect(hashedKey).toBe(createHash("sha256").update(key).digest("hex"));
    expect(hashedKey).toMatch(/^[0-9a-f]{64}$/);
    expect(hashedKey).not.toContain(key.slice(3));
  });

  it("never repeats a key", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey().key));
    expect(keys.size).toBe(200);
  });
});

describe("hashApiKey", () => {
  it("matches the SHA-256 test vector", () => {
    expect(hashApiKey("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic and distinguishes keys", () => {
    expect(hashApiKey(KEY)).toBe(hashApiKey(KEY));
    expect(hashApiKey(KEY)).not.toBe(hashApiKey(`${KEY}x`));
  });
});

describe("getRequestUser with an API key", () => {
  it("resolves the owner of a valid key", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow());
    await expect(getRequestUser(withBearer(`Bearer ${KEY}`))).resolves.toEqual({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      role: "USER",
      via: "apiKey",
    });
    expect(mocks.apiKeyFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hashedKey: hashApiKey(KEY) } }),
    );
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("accepts the scheme in any case and surrounding whitespace", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow());
    await expect(getRequestUser(withBearer(`  bearer   ${KEY}  `))).resolves.toMatchObject({
      via: "apiKey",
    });
  });

  it("rejects a bearer token without the lk_ prefix without a lookup or session fallback", async () => {
    await expect(getRequestUser(withBearer("Bearer sk_live_123"))).resolves.toBeNull();
    expect(mocks.apiKeyFindUnique).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("rejects an unknown key", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(null);
    await expect(getRequestUser(withBearer(`Bearer ${KEY}`))).resolves.toBeNull();
  });

  it("rejects a key whose owner is banned", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(
      apiKeyRow({ user: { ...OWNER, bannedAt: new Date("2026-01-01") } }),
    );
    await expect(getRequestUser(withBearer(`Bearer ${KEY}`))).resolves.toBeNull();
  });

  it("rejects a key at or past its expiry", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow({ expiresAt: NOW }));
    await expect(getRequestUser(withBearer(`Bearer ${KEY}`))).resolves.toBeNull();
    mocks.apiKeyFindUnique.mockResolvedValue(
      apiKeyRow({ expiresAt: new Date(NOW.getTime() + 1000) }),
    );
    await expect(getRequestUser(withBearer(`Bearer ${KEY}`))).resolves.toMatchObject({
      via: "apiKey",
    });
  });

  it("records first use", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow({ lastUsedAt: null }));
    await getRequestUser(withBearer(`Bearer ${KEY}`));
    expect(mocks.apiKeyUpdate).toHaveBeenCalledWith({
      where: { id: "key_1" },
      data: { lastUsedAt: NOW },
    });
  });

  it("throttles last-used writes to once a minute", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(
      apiKeyRow({ lastUsedAt: new Date(NOW.getTime() - 30_000) }),
    );
    await getRequestUser(withBearer(`Bearer ${KEY}`));
    expect(mocks.apiKeyUpdate).not.toHaveBeenCalled();

    mocks.apiKeyFindUnique.mockResolvedValue(
      apiKeyRow({ lastUsedAt: new Date(NOW.getTime() - 61_000) }),
    );
    await getRequestUser(withBearer(`Bearer ${KEY}`));
    expect(mocks.apiKeyUpdate).toHaveBeenCalledTimes(1);
  });

  it("still authenticates when the last-used write fails", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow());
    mocks.apiKeyUpdate.mockRejectedValue(new Error("db busy"));
    await expect(getRequestUser(withBearer(`Bearer ${KEY}`))).resolves.toMatchObject({
      id: "user_1",
    });
  });
});

describe("getRequestUser with a session", () => {
  it.each(["", "Bearer", "Basic dXNlcjpwYXNz", `Token ${KEY}`])(
    "falls back to the session for the authorization header %o",
    async (header) => {
      mocks.auth.mockResolvedValue(null);
      const request = header ? withBearer(header) : new Request("https://lnk.example/api/links");
      await expect(getRequestUser(request)).resolves.toBeNull();
      expect(mocks.auth).toHaveBeenCalledTimes(1);
      expect(mocks.apiKeyFindUnique).not.toHaveBeenCalled();
    },
  );

  it("re-reads the session user from the database", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1", role: "USER" } });
    mocks.userFindUnique.mockResolvedValue({ ...OWNER, role: "ADMIN" });
    await expect(getRequestUser(new Request("https://lnk.example/api/links"))).resolves.toEqual({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      role: "ADMIN",
      via: "session",
    });
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" } }),
    );
  });

  it.each([
    ["a session without a user id", { user: {} }, OWNER],
    ["a deleted user", { user: { id: "user_1" } }, null],
    ["a banned user", { user: { id: "user_1" } }, { ...OWNER, bannedAt: new Date("2026-01-01") }],
  ])("rejects %s", async (_label, session, dbUser) => {
    mocks.auth.mockResolvedValue(session);
    mocks.userFindUnique.mockResolvedValue(dbUser);
    await expect(getRequestUser(new Request("https://lnk.example/api/links"))).resolves.toBeNull();
  });
});

describe("requireUser and requireAdmin", () => {
  const anonymous = () => new Request("https://lnk.example/api/admin/users");

  it("answers 401 with a hint when nobody is signed in", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await requireUser(anonymous());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      error: expect.stringContaining("Authorization: Bearer"),
    });
  });

  it("passes the user through", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow());
    const result = await requireUser(withBearer(`Bearer ${KEY}`));
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ id: "user_1" }) });
  });

  it("answers 403 for a signed-in non-admin", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow());
    const result = await requireAdmin(withBearer(`Bearer ${KEY}`));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({ error: "Admins only" });
  });

  it("answers 401 rather than 403 when nobody is signed in", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await requireAdmin(anonymous());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("lets an admin through", async () => {
    mocks.apiKeyFindUnique.mockResolvedValue(apiKeyRow({ user: { ...OWNER, role: "ADMIN" } }));
    const result = await requireAdmin(withBearer(`Bearer ${KEY}`));
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ role: "ADMIN" }) });
  });
});
