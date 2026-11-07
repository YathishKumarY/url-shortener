import { describe, expect, it, vi } from "vitest";
import { oauthEmailVerified } from "@/lib/oauth-email";

function githubEmails(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }) as Response);
}

describe("oauthEmailVerified", () => {
  it("trusts Google only when it marks the email verified", async () => {
    expect(await oauthEmailVerified("google", "a@b.com", { email_verified: true }, "t")).toBe(true);
    expect(await oauthEmailVerified("google", "a@b.com", { email_verified: false }, "t")).toBe(
      false,
    );
    expect(await oauthEmailVerified("google", "a@b.com", {}, "t")).toBe(false);
  });

  it("checks GitHub's emails endpoint for a verified match", async () => {
    const fetchImpl = githubEmails([
      { email: "other@b.com", verified: true },
      { email: "Me@B.com", verified: true },
    ]);
    expect(await oauthEmailVerified("github", "me@b.com", {}, "tok", fetchImpl)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/user/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    );
  });

  it("refuses a GitHub email that is present but unverified", async () => {
    const fetchImpl = githubEmails([{ email: "me@b.com", verified: false }]);
    expect(await oauthEmailVerified("github", "me@b.com", {}, "tok", fetchImpl)).toBe(false);
  });

  it("refuses GitHub when the email is missing, the call fails or there is no token", async () => {
    expect(
      await oauthEmailVerified(
        "github",
        "me@b.com",
        {},
        "tok",
        githubEmails([{ email: "x@b.com", verified: true }]),
      ),
    ).toBe(false);
    expect(await oauthEmailVerified("github", "me@b.com", {}, "tok", githubEmails({}, false))).toBe(
      false,
    );
    const rejecting = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await oauthEmailVerified("github", "me@b.com", {}, "tok", rejecting)).toBe(false);
    expect(await oauthEmailVerified("github", "me@b.com", {}, undefined)).toBe(false);
  });

  it("trusts an OIDC provider unless it says the email is unverified", async () => {
    expect(await oauthEmailVerified("oidc", "a@b.com", {}, undefined)).toBe(true);
    expect(await oauthEmailVerified("oidc", "a@b.com", { email_verified: true }, undefined)).toBe(
      true,
    );
    expect(await oauthEmailVerified("oidc", "a@b.com", { email_verified: false }, undefined)).toBe(
      false,
    );
    expect(
      await oauthEmailVerified("oidc", "a@b.com", { email_verified: "false" }, undefined),
    ).toBe(false);
  });

  it("refuses providers it does not know", async () => {
    expect(await oauthEmailVerified("twitter", "a@b.com", { email_verified: true }, "t")).toBe(
      false,
    );
  });
});
