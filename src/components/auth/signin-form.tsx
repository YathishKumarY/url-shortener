"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { ResendVerification, type ResendState } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FieldErrors {
  email?: string;
  password?: string;
}

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendState, setResendState] = useState<ResendState>("idle");
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  function validate(): boolean {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUnverifiedEmail("");

    if (!validate()) return;

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        const code = (result as { code?: string }).code;
        if (code === "email_not_verified") {
          setUnverifiedEmail(email.trim());
          setResendState("idle");
          setError("Verify your email first. Open the link we sent you, then sign in.");
          return;
        }
        setError(
          code === "rate_limited"
            ? "Too many sign-in attempts. Please wait a few minutes."
            : code === "banned"
              ? "This account has been suspended."
              : "Invalid email or password",
        );
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {error}
        </p>
      )}
      {unverifiedEmail && (
        <ResendVerification email={unverifiedEmail} state={resendState} onState={setResendState} />
      )}
      <div>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
          }}
          className={`border-border bg-input h-12 rounded-[var(--radius-pill)] px-5 ${fieldErrors.email ? "border-destructive" : ""}`}
        />
        {fieldErrors.email && (
          <p className="text-destructive mt-1 pl-5 text-xs">{fieldErrors.email}</p>
        )}
      </div>
      <div>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
          }}
          className={`border-border bg-input h-12 rounded-[var(--radius-pill)] px-5 ${fieldErrors.password ? "border-destructive" : ""}`}
        />
        {fieldErrors.password && (
          <p className="text-destructive mt-1 pl-5 text-xs">{fieldErrors.password}</p>
        )}
      </div>
      <div className="text-right">
        <Link
          href="/auth/forgot-password"
          className="text-muted-foreground hover:text-primary text-xs"
        >
          Forgot password?
        </Link>
      </div>
      {/* Base UI buttons default to type="button", which never submits a form. */}
      <Button
        type="submit"
        disabled={loading}
        className="h-12 rounded-[var(--radius-pill)] text-[15px] font-semibold"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Sign In
      </Button>
    </form>
  );
}
