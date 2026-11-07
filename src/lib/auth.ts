import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { config } from "@/lib/config";
import { oauthEmailVerified } from "@/lib/oauth-email";
import { prisma } from "@/lib/prisma";
import { getClientIp, signInLimiter } from "@/lib/rate-limit";
import type { Provider } from "next-auth/providers";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

class BannedSignin extends CredentialsSignin {
  code = "banned";
}

class EmailNotVerifiedSignin extends CredentialsSignin {
  code = "email_not_verified";
}

function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && config.adminEmails.includes(email.toLowerCase());
}

/** Emails are stored lower-case, but older rows and providers may differ in case. */
function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
}

/**
 * OAuth providers are only registered when their credentials exist, so a
 * self-hosted instance without Google or GitHub apps shows no dead buttons.
 */
const oauthProviders: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) oauthProviders.push(Google);
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) oauthProviders.push(GitHub);

/** Any OpenID Connect identity provider (Okta, Entra ID, Keycloak, Authentik...). */
export const ssoProviderName = process.env.AUTH_OIDC_NAME?.trim() || "SSO";
if (process.env.AUTH_OIDC_ISSUER && process.env.AUTH_OIDC_ID && process.env.AUTH_OIDC_SECRET) {
  oauthProviders.push({
    id: "oidc",
    name: ssoProviderName,
    type: "oidc",
    issuer: process.env.AUTH_OIDC_ISSUER,
    clientId: process.env.AUTH_OIDC_ID,
    clientSecret: process.env.AUTH_OIDC_SECRET,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...oauthProviders,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();

        // Credential sign-in had no rate limit at all, which left passwords
        // open to unlimited guessing. Keyed on email + IP so one attacker
        // cannot lock a victim out from everywhere.
        try {
          const { success } = await signInLimiter.limit(`${email}:${getClientIp(request)}`);
          if (!success) throw new RateLimitedSignin();
        } catch (err) {
          if (err instanceof RateLimitedSignin) throw err;
          console.error("[auth] Rate limit check failed:", err);
        }

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (!user?.password) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.password);
        if (!valid) return null;
        if (user.bannedAt) throw new BannedSignin();
        // Checked after the password, so the answer reveals nothing to
        // someone who does not already know it.
        if (!user.emailVerified) throw new EmailNotVerifiedSignin();

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      if (!user.email) return "/auth/signin?error=EmailRequired";
      const email = user.email.trim().toLowerCase();

      const verified = await oauthEmailVerified(
        account.provider,
        email,
        profile as Record<string, unknown> | undefined,
        account.access_token,
      );
      if (!verified) return "/auth/signin?error=EmailUnverified";

      const existing = await findUserByEmail(email);
      if (existing?.bannedAt) return "/auth/signin?error=AccountBanned";

      if (!existing) {
        if (config.registrationDisabled) return "/auth/signin?error=RegistrationDisabled";
        await prisma.user.create({
          data: {
            email,
            name: user.name,
            image: user.image,
            emailVerified: new Date(),
            role: isAdminEmail(email) ? "ADMIN" : "USER",
          },
        });
      } else if (!existing.emailVerified) {
        // The provider has just proved the address. Any password on the
        // account was set by whoever signed up without verifying, possibly
        // not this person, so it stops working; "Forgot password" sets a
        // new one.
        await prisma.user.update({
          where: { id: existing.id },
          data: { emailVerified: new Date(), password: null },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        let dbUser = await findUserByEmail(user.email);
        if (dbUser && dbUser.role !== "ADMIN" && isAdminEmail(dbUser.email)) {
          dbUser = await prisma.user.update({ where: { id: dbUser.id }, data: { role: "ADMIN" } });
        }
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as "USER" | "ADMIN";
      return session;
    },
  },
});

/** Names of the configured OAuth providers, for the sign-in page. */
export const enabledOAuthProviders = oauthProviders.map((p) =>
  typeof p === "function" ? p().id : p.id,
);
