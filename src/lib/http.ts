import { NextResponse } from "next/server";
import { firstZodError, formatZodErrors } from "@/lib/validators";
import type { z } from "zod";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** 400 with both a single message (for toasts) and per-field errors (for forms). */
export function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: firstZodError(error), fieldErrors: formatZodErrors(error) },
    { status: 400 },
  );
}

/** Parse a JSON body, or return a ready-made 400 response. */
export async function readJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: jsonError("Invalid request body. Please send valid JSON.", 400),
    };
  }
}

/** Prisma unique-constraint violation, detected by code rather than message text. */
export function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

/** Prisma "record to update/delete not found". */
export function isNotFoundError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2025";
}
