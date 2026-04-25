import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function generateEmailVerificationToken(email: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({ where: { email } });

  return prisma.emailVerificationToken.create({
    data: { email, token, expires },
  });
}

export async function generatePasswordResetToken(email: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { email } });

  return prisma.passwordResetToken.create({
    data: { email, token, expires },
  });
}

export async function verifyEmailToken(token: string) {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) return null;
  return record;
}

export async function verifyPasswordResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) return null;
  return record;
}
