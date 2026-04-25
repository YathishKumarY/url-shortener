import { Suspense } from "react";
import Link from "next/link";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignInForm } from "@/components/auth/signin-form";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Sign In" };

export default function SignInPage() {
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

        <OAuthButtons />

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">OR</span>
          <Separator className="flex-1" />
        </div>

        <Suspense>
          <SignInForm />
        </Suspense>

        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-primary font-semibold hover:underline">
            Register Now
          </Link>
        </p>
      </div>
    </div>
  );
}
