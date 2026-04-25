"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState(token ? "" : "Missing verification token");

  useEffect(() => {
    if (!token) return;

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.error);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong");
      });
  }, [token]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Link href="/" className="inline-flex items-baseline">
          <span className="gradient-logo text-4xl font-extrabold">Linkly</span>
          <span className="text-foreground/50 -mt-3 -ml-0.5 text-sm">®</span>
        </Link>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="text-primary h-12 w-12 animate-spin" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="text-success h-12 w-12" />
            <p className="text-foreground text-lg font-semibold">{message}</p>
            <Link
              href="/auth/signin"
              className="bg-primary hover:bg-primary/90 rounded-[48px] px-6 py-3 text-sm font-semibold text-white"
            >
              Sign In
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="text-destructive h-12 w-12" />
            <p className="text-foreground text-lg font-semibold">{message}</p>
            <Link
              href="/auth/signup"
              className="bg-primary hover:bg-primary/90 rounded-[48px] px-6 py-3 text-sm font-semibold text-white"
            >
              Try Again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
