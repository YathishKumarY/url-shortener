import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { authLimiter, enforceRateLimit } from "@/lib/rate-limit";
import { passwordChangeSchema } from "@/lib/validators";

/** Change the password, or set one on an OAuth-only account. */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.via !== "session")
    return jsonError("Password changes require a dashboard session", 403);

  const limit = await enforceRateLimit(authLimiter, `password:${auth.user.id}`);
  if (!limit.ok) return limit.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = passwordChangeSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { password: true },
  });
  if (!user) return jsonError("Account not found", 404);

  if (user.password) {
    const current = parsed.data.currentPassword ?? "";
    if (!(await bcrypt.compare(current, user.password))) {
      return jsonError("Current password is incorrect", 400, {
        fieldErrors: { currentPassword: ["Current password is incorrect"] },
      });
    }
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { password: await bcrypt.hash(parsed.data.newPassword, 12) },
  });
  return NextResponse.json({ message: "Password updated" });
}
