import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

function get(url: string) {
  return proxy(new NextRequest(url));
}

describe("proxy: canonical host for auth pages", () => {
  it("moves sign-in from a Vercel deployment address to AUTH_URL in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://linkly-sh.vercel.app");

    const res = get("https://url-shortener-abc123-team.vercel.app/auth/signin?error=Configuration");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://linkly-sh.vercel.app/auth/signin?error=Configuration",
    );
  });

  it("leaves the canonical host alone", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://linkly-sh.vercel.app");
    expect(get("https://linkly-sh.vercel.app/auth/signin").headers.get("location")).toBeNull();
  });

  it("does nothing outside Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("AUTH_URL", "https://linkly-sh.vercel.app");
    expect(
      get("https://url-shortener-git-x.vercel.app/auth/signin").headers.get("location"),
    ).toBeNull();

    vi.stubEnv("VERCEL_ENV", "");
    expect(get("http://localhost:3000/auth/signin").headers.get("location")).toBeNull();
  });
});
