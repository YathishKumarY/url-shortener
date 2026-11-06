import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import type { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface RequestUser {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  via: "session" | "apiKey";
}

const KEY_PREFIX = "lk_";
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** A new key: shown to the owner once, stored only as a SHA-256 hash. */
export function generateApiKey(): { key: string; prefix: string; hashedKey: string } {
  const bytes = randomBytes(32);
  const body = Array.from(bytes, (b) => BASE62[b % 62]).join("");
  const key = `${KEY_PREFIX}${body}`;
  return { key, prefix: key.slice(0, 10), hashedKey: hashApiKey(key) };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

const LAST_USED_RESOLUTION_MS = 60_000;

/**
 * The caller, from an API key (`Authorization: Bearer lk_...`) or the session
 * cookie. The user row is always re-read, so a ban or role change applies to
 * the very next request instead of waiting for a JWT to expire.
 */
export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  const token = bearerToken(request);
  if (token) {
    if (!token.startsWith(KEY_PREFIX)) return null;
    const apiKey = await prisma.apiKey.findUnique({
      where: { hashedKey: hashApiKey(token) },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, bannedAt: true } },
      },
    });
    if (!apiKey || apiKey.user.bannedAt) return null;
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return null;

    if (!apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      await prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
    }
    const { id, email, name, role } = apiKey.user;
    return { id, email, name, role, via: "apiKey" };
  }

  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, bannedAt: true },
  });
  if (!user || user.bannedAt) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, via: "session" };
}

export type AuthResult = { ok: true; user: RequestUser } | { ok: false; response: NextResponse };

export async function requireUser(request: Request): Promise<AuthResult> {
  const user = await getRequestUser(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized. Sign in, or send an API key as 'Authorization: Bearer <key>'." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

export async function requireAdmin(request: Request): Promise<AuthResult> {
  const result = await requireUser(request);
  if (!result.ok) return result;
  if (result.user.role !== "ADMIN") {
    return { ok: false, response: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  }
  return result;
}
