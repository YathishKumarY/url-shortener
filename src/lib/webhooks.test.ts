import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsafeUrlError } from "@/lib/safe-fetch";
import {
  WEBHOOK_EVENTS,
  deliverWebhook,
  dispatchWebhooks,
  generateWebhookSecret,
  signPayload,
  verifySignature,
} from "@/lib/webhooks";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/safe-fetch", () => ({
  safeFetch: mocks.safeFetch,
  UnsafeUrlError: class UnsafeUrlError extends Error {},
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { webhook: { update: mocks.update, findMany: mocks.findMany } },
}));

const SECRET = "whsec_test";
const HOOK = { id: "wh_1", url: "https://hooks.example.com/linkly", secret: SECRET };

function delivered(status: number) {
  return { status, headers: new Headers(), finalUrl: HOOK.url, body: "" };
}

beforeEach(() => {
  mocks.safeFetch.mockReset();
  mocks.update.mockReset();
  mocks.update.mockResolvedValue({});
  mocks.findMany.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SITE_NAME", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signPayload", () => {
  it("formats the header as sha256=<hex HMAC of the raw body>", () => {
    const body = '{"event":"link.created"}';
    const expected = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(signPayload(SECRET, body)).toBe(`sha256=${expected}`);
    expect(signPayload(SECRET, body)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("matches the RFC 4231 HMAC-SHA256 test vector", () => {
    expect(signPayload("Jefe", "what do ya want for nothing?")).toBe(
      "sha256=5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("changes with the secret and with the body", () => {
    const base = signPayload(SECRET, "body");
    expect(signPayload("whsec_other", "body")).not.toBe(base);
    expect(signPayload(SECRET, "body ")).not.toBe(base);
  });
});

describe("verifySignature", () => {
  const body = '{"id":"evt_1","event":"link.clicked"}';
  const signature = signPayload(SECRET, body);

  it("accepts the correct signature", () => {
    expect(verifySignature(SECRET, body, signature)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifySignature(SECRET, body.replace("clicked", "deleted"), signature)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(verifySignature(SECRET, body, signPayload("whsec_other", body))).toBe(false);
  });

  it("rejects a flipped character of the same length", () => {
    const last = signature.at(-1) === "0" ? "1" : "0";
    expect(verifySignature(SECRET, body, signature.slice(0, -1) + last)).toBe(false);
  });

  // The last case has the right number of characters but one more byte.
  it.each([
    "",
    "sha256=",
    "sha256=abc",
    signature.slice("sha256=".length),
    `${signature}0`,
    `sha256=é${"0".repeat(63)}`,
  ])("returns false without throwing for the wrong-length signature %o", (candidate) => {
    expect(() => verifySignature(SECRET, body, candidate)).not.toThrow();
    expect(verifySignature(SECRET, body, candidate)).toBe(false);
  });
});

describe("generateWebhookSecret", () => {
  it("returns a prefixed 24-byte hex secret", () => {
    expect(generateWebhookSecret()).toMatch(/^whsec_[0-9a-f]{48}$/);
  });

  it("is random", () => {
    const secrets = new Set(Array.from({ length: 50 }, generateWebhookSecret));
    expect(secrets.size).toBe(50);
  });
});

describe("WEBHOOK_EVENTS", () => {
  it("re-exports the four link events", () => {
    expect([...WEBHOOK_EVENTS]).toEqual([
      "link.created",
      "link.updated",
      "link.deleted",
      "link.clicked",
    ]);
  });
});

describe("deliverWebhook", () => {
  it("posts a signed JSON envelope and records the status", async () => {
    mocks.safeFetch.mockResolvedValue(delivered(204));
    const data = { id: "link_1", shortCode: "abc1234" };

    await expect(deliverWebhook(HOOK, "link.created", data)).resolves.toEqual({
      status: 204,
      error: null,
    });

    expect(mocks.safeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mocks.safeFetch.mock.calls[0];
    expect(url).toBe(HOOK.url);
    expect(init).toMatchObject({
      method: "POST",
      maxRedirects: 0,
      timeoutMs: 5000,
      maxBytes: 4096,
    });
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "User-Agent": "Linkly-Webhooks/1.0",
      "X-Linkly-Event": "link.created",
    });

    const envelope = JSON.parse(init.body);
    expect(envelope).toEqual({
      id: expect.stringMatching(/^evt_[0-9a-f]{24}$/),
      event: "link.created",
      createdAt: expect.any(String),
      data,
    });
    expect(new Date(envelope.createdAt).toISOString()).toBe(envelope.createdAt);
    expect(verifySignature(SECRET, init.body, init.headers["X-Linkly-Signature"])).toBe(true);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "wh_1" },
      data: { lastStatus: 204, lastError: null, lastTriggeredAt: expect.any(Date) },
    });
  });

  it("reports an HTTP error status", async () => {
    mocks.safeFetch.mockResolvedValue(delivered(500));
    await expect(deliverWebhook(HOOK, "link.updated", {})).resolves.toEqual({
      status: 500,
      error: "Endpoint responded with HTTP 500",
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastStatus: 500,
          lastError: "Endpoint responded with HTTP 500",
        }),
      }),
    );
  });

  it("records a refused or failed delivery without throwing", async () => {
    mocks.safeFetch.mockRejectedValue(
      new UnsafeUrlError("Refusing to fetch a private or reserved address"),
    );
    await expect(deliverWebhook(HOOK, "ping", {})).resolves.toEqual({
      status: null,
      error: "Refusing to fetch a private or reserved address",
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastStatus: null }) }),
    );
  });

  it("uses a generic message for a non-Error rejection", async () => {
    mocks.safeFetch.mockRejectedValue("boom");
    await expect(deliverWebhook(HOOK, "ping", {})).resolves.toEqual({
      status: null,
      error: "Delivery failed",
    });
  });

  it("ignores a failure to record the outcome", async () => {
    mocks.safeFetch.mockResolvedValue(delivered(200));
    mocks.update.mockRejectedValue(new Error("db down"));
    await expect(deliverWebhook(HOOK, "link.clicked", {})).resolves.toEqual({
      status: 200,
      error: null,
    });
  });

  it("names the site in the user agent", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_NAME", "Shorty");
    mocks.safeFetch.mockResolvedValue(delivered(200));
    await deliverWebhook(HOOK, "ping", {});
    expect(mocks.safeFetch.mock.calls[0][1].headers["User-Agent"]).toBe("Shorty-Webhooks/1.0");
  });
});

describe("dispatchWebhooks", () => {
  it("does nothing for an anonymous link", async () => {
    await dispatchWebhooks(null, "link.created", {});
    await dispatchWebhooks(undefined, "link.created", {});
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("delivers to every enabled hook subscribed to the event", async () => {
    mocks.findMany.mockResolvedValue([
      HOOK,
      { id: "wh_2", url: "https://b.example/hook", secret: "s2" },
    ]);
    mocks.safeFetch.mockResolvedValue(delivered(200));

    await dispatchWebhooks("user_1", "link.deleted", { id: "link_1" });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "user_1", enabled: true, events: { has: "link.deleted" } },
      select: { id: true, url: true, secret: true },
    });
    expect(mocks.safeFetch.mock.calls.map(([url]) => url)).toEqual([
      HOOK.url,
      "https://b.example/hook",
    ]);
  });

  it("keeps delivering when one endpoint fails", async () => {
    mocks.findMany.mockResolvedValue([
      HOOK,
      { id: "wh_2", url: "https://b.example/hook", secret: "s2" },
    ]);
    mocks.safeFetch
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(delivered(200));

    await expect(dispatchWebhooks("user_1", "link.clicked", {})).resolves.toBeUndefined();
    expect(mocks.safeFetch).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("logs instead of throwing when the lookup fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.findMany.mockRejectedValue(new Error("db down"));
    await expect(dispatchWebhooks("user_1", "link.created", {})).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("link.created"), expect.any(Error));
  });
});
