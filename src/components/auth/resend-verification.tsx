"use client";

import { Loader2 } from "lucide-react";

export type ResendState = "idle" | "sending" | "sent" | "error";

/** "Didn't get it?" line that asks for another verification email. */
export function ResendVerification({
  email,
  state,
  onState,
}: {
  email: string;
  state: ResendState;
  onState: (state: ResendState) => void;
}) {
  async function resend() {
    onState("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      onState(res.ok ? "sent" : "error");
    } catch {
      onState("error");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-muted-foreground text-center text-sm">
        Sent. Check your inbox and spam folder for a new link.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-center text-sm">
      {state === "error" ? "Couldn't send it. " : "Didn't get the email? "}
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending"}
        className="text-primary inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-60"
      >
        {state === "sending" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {state === "error" ? "Try again" : "Send it again"}
      </button>
    </p>
  );
}
