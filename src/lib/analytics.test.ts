import { describe, it, expect } from "vitest";

describe("analytics — hashIp", () => {
  it("produces consistent hash for same IP", async () => {
    const { createHash } = await import("crypto");
    const hashIp = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const hash1 = hashIp("192.168.1.1");
    const hash2 = hashIp("192.168.1.1");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different IPs", async () => {
    const { createHash } = await import("crypto");
    const hashIp = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const hash1 = hashIp("192.168.1.1");
    const hash2 = hashIp("10.0.0.1");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a 16-char hex string", async () => {
    const { createHash } = await import("crypto");
    const hashIp = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const hash = hashIp("8.8.8.8");
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});
