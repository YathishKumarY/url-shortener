import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  sendVerificationLink: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: mocks.findFirst, create: mocks.create, update: mocks.update } },
}));
vi.mock("@/lib/verification", () => ({ sendVerificationLink: mocks.sendVerificationLink }));
vi.mock("@/lib/rate-limit", () => ({
  authLimiter: { limit: vi.fn(async () => ({ success: true })) },
  getClientIp: () => "203.0.113.9",
}));

const { POST } = await import("@/app/api/auth/register/route");

function register(body: Record<string, string>) {
  return POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const input = { name: "Ada", email: "Ada@Example.com", password: "correct horse" };

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendVerificationLink.mockResolvedValue("sent");
  });

  it("creates an unverified account and emails a link instead of signing in", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const res = await register(input);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      verificationRequired: true,
      email: "ada@example.com",
      emailSent: true,
    });
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.email).toBe("ada@example.com");
    expect(data.emailVerified).toBeUndefined();
    expect(data.password).not.toBe(input.password);
    expect(mocks.sendVerificationLink).toHaveBeenCalledWith("ada@example.com");
  });

  it("reports when the email could not be sent", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.sendVerificationLink.mockResolvedValue("failed");
    const res = await register(input);
    expect(res.status).toBe(201);
    expect((await res.json()).emailSent).toBe(false);
  });

  it("refuses an address that already belongs to a verified account", async () => {
    mocks.findFirst.mockResolvedValue({ id: "u1", emailVerified: new Date(), password: "hash" });
    const res = await register(input);
    expect(res.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.sendVerificationLink).not.toHaveBeenCalled();
  });

  it("refuses an address that signed up with Google or GitHub", async () => {
    mocks.findFirst.mockResolvedValue({ id: "u1", emailVerified: null, password: null });
    const res = await register(input);
    expect(res.status).toBe(409);
  });

  it("replaces a pending sign-up that was never verified and sends a new link", async () => {
    mocks.findFirst.mockResolvedValue({ id: "u1", emailVerified: null, password: "old-hash" });
    const res = await register(input);

    expect(res.status).toBe(201);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ name: "Ada" }),
      }),
    );
    expect(mocks.sendVerificationLink).toHaveBeenCalledWith("ada@example.com");
  });
});
