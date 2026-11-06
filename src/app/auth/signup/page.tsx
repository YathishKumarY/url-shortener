import Link from "next/link";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignUpForm } from "@/components/auth/signup-form";
import { Separator } from "@/components/ui/separator";
import { enabledOAuthProviders, ssoProviderName } from "@/lib/auth";
import { config } from "@/lib/config";

export const metadata = { title: "Create Account" };

// Rendered per request so DISABLE_REGISTRATION and the OAuth provider list
// follow the runtime environment, not the one present at build time.
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (config.registrationDisabled) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-foreground text-2xl font-bold">Registration is closed</h1>
          <p className="text-muted-foreground text-sm">
            This Linkly instance is invite-only. Ask an administrator for an account.
          </p>
          <Link href="/auth/signin" className="text-primary font-semibold hover:underline">
            Sign in instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-baseline">
            <span className="gradient-logo text-4xl font-extrabold">Linkly</span>
            <span className="text-foreground/50 -mt-3 -ml-0.5 text-sm">®</span>
          </Link>
          <h1 className="text-foreground mt-6 text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Start shortening URLs and tracking clicks for free
          </p>
        </div>

        <OAuthButtons providers={enabledOAuthProviders} ssoName={ssoProviderName} />

        {enabledOAuthProviders.length > 0 && (
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">OR</span>
            <Separator className="flex-1" />
          </div>
        )}

        <SignUpForm />

        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-primary font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
