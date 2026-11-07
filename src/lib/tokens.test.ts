import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailVerificationToken: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      deleteMany: mocks.deleteMany,
    },
  },
}));

const { consumeEmailVerificationToken, verificationEmailRecentlySent } =
  await import("@/lib/tokens");

const future = () => new Date(Date.now() + 60_000);

describe("consumeEmailVerificationToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the address and deletes the token", async () => {
    mocks.findUnique.mockResolvedValue({ id: "t1", email: "a@b.com", expires: future() });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    expect(await consumeEmailVerificationToken("abc")).toBe("a@b.com");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("rejects unknown tokens", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await consumeEmailVerificationToken("abc")).toBeNull();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a token another request claimed first", async () => {
    mocks.findUnique.mockResolvedValue({ id: "t1", email: "a@b.com", expires: future() });
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect(await consumeEmailVerificationToken("abc")).toBeNull();
  });

  it("rejects, and still removes, an expired token", async () => {
    mocks.findUnique.mockResolvedValue({ id: "t1", email: "a@b.com", expires: new Date(0) });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    expect(await consumeEmailVerificationToken("abc")).toBeNull();
    expect(mocks.deleteMany).toHaveBeenCalled();
  });
});

describe("verificationEmailRecentlySent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks for a token issued within the last minute", async () => {
    mocks.findFirst.mockResolvedValue({ id: "t1" });
    const before = Date.now();
    expect(await verificationEmailRecentlySent("a@b.com")).toBe(true);

    const where = mocks.findFirst.mock.calls[0][0].where;
    expect(where.email).toBe("a@b.com");
    // Issued less than a minute ago means expiring more than 23h59m from now.
    const threshold = where.expires.gt.getTime() - before;
    expect(threshold).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 60 * 1000);
    expect(threshold).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("is false when no recent token exists", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await verificationEmailRecentlySent("a@b.com")).toBe(false);
  });
});
