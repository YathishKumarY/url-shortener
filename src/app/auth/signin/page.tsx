import { Suspense } from "react";
import Link from "next/link";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignInForm } from "@/components/auth/signin-form";
import { Separator } from "@/components/ui/separator";
import { enabledOAuthProviders, ssoProviderName } from "@/lib/auth";
import { config } from "@/lib/config";

export const metadata = { title: "Sign In" };

const ERRORS: Record<string, string> = {
  AccountBanned: "This account has been suspended.",
  RegistrationDisabled: "New sign-ups are disabled on this instance. Ask an admin for an account.",
  OAuthAccountNotLinked: "That email is already registered with a different sign-in method.",
  AccessDenied: "Sign-in was denied.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? null) : null;
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-baseline">
            <span className="gradient-logo text-4xl font-extrabold">Linkly</span>
            <span className="text-foreground/50 -mt-3 -ml-0.5 text-sm">®</span>
          </Link>
          <h1 className="text-foreground mt-6 text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sign in to manage your shortened links
          </p>
        </div>

        {message && (
          <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-center text-sm">
            {message}
          </p>
        )}

        <OAuthButtons providers={enabledOAuthProviders} ssoName={ssoProviderName} />

        {enabledOAuthProviders.length > 0 && (
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">OR</span>
            <Separator className="flex-1" />
          </div>
        )}

        <Suspense>
          <SignInForm />
        </Suspense>

        {!config.registrationDisabled && (
          <p className="text-muted-foreground text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-primary font-semibold hover:underline">
              Register Now
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
