"use client";

import { useId, useState } from "react";
import { CircleCheck, Flag, Loader2 } from "lucide-react";
import { Field, inputClass, pill } from "@/components/shared/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { REPORT_REASONS } from "@/lib/validators";

type Reason = (typeof REPORT_REASONS)[number];

// Typed against REPORT_REASONS so a new server-side reason fails the build
// here instead of silently missing from the form. (A type-only import keeps
// zod out of the client bundle.)
const REASONS: Record<Reason, { label: string; hint: string }> = {
  phishing: { label: "Phishing", hint: "Imitates another site to steal logins or payment details" },
  malware: { label: "Malware", hint: "Downloads or installs harmful software" },
  spam: { label: "Spam or scam", hint: "Unwanted ads, fake offers or misleading content" },
  illegal: { label: "Illegal content", hint: "Content that breaks the law" },
  other: { label: "Something else", hint: "Tell us what is wrong in the details below" },
};
const REASON_KEYS = Object.keys(REASONS) as Reason[];
const DETAILS_MAX = 1000;

interface ReportDialogProps {
  code: string;
  /** The link's namespace: "" for the app's own domain, else the custom hostname. */
  domain: string;
  displayUrl: string;
  className?: string;
}

/** "Report this link" button and form, posting to /api/reports. */
export function ReportDialog({ code, domain, displayUrl, className }: ReportDialogProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function handleOpenChange(next: boolean) {
    if (status === "sending") return;
    // Start fresh when reopening after a sent report; resetting on close
    // instead would flash the empty form during the closing animation.
    if (next && status === "sent") {
      setReason(null);
      setDetails("");
      setEmail("");
      setStatus("idle");
      setMessage("");
    }
    setOpen(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) {
      setError("Choose the reason that fits best.");
      return;
    }
    setStatus("sending");
    setError(null);
    setEmailError(null);
    try {
      const result = await apiFetch<{ message?: string }>("/api/reports", {
        method: "POST",
        json: {
          code,
          domain,
          reason,
          ...(details.trim() ? { details: details.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      });
      setMessage(result?.message ?? "Thanks, our team will review this link.");
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      if (!(err instanceof ApiError)) {
        setError("Could not send the report. Check your connection and try again.");
      } else if (err.status === 404) {
        setError("This link no longer exists, so there is nothing left to report.");
      } else if (err.fieldErrors?.email) {
        setEmailError("Enter a valid email address, or leave this empty.");
      } else {
        setError(err.message);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={cn(pill.ghost, pill.small, "text-muted-foreground", className)}>
        <Flag />
        Report this link
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-md">
        {status === "sent" ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-green-500/12 text-green-600 dark:text-green-400">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <DialogTitle className="text-foreground mt-4 text-base font-semibold">
              Report received
            </DialogTitle>
            <DialogDescription className="mt-1.5 max-w-xs leading-relaxed">
              {message}
            </DialogDescription>
            <button
              type="button"
              autoFocus
              onClick={() => setOpen(false)}
              className={cn(pill.primary, pill.small, "mt-6")}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5"
            aria-busy={status === "sending"}
          >
            <div className="pr-8">
              <DialogTitle className="text-foreground text-base font-semibold">
                Report this link
              </DialogTitle>
              <DialogDescription className="mt-1.5 leading-relaxed">
                Tell us what is wrong with{" "}
                <span className="text-foreground font-medium break-all">{displayUrl}</span>. Our
                moderators review every report.
              </DialogDescription>
            </div>

            <fieldset>
              <legend className="text-card-foreground mb-2 text-[13px] font-medium">Reason</legend>
              <div className="space-y-2">
                {REASON_KEYS.map((key) => {
                  const checked = reason === key;
                  return (
                    <label
                      key={key}
                      className="border-border/70 bg-secondary/40 hover:bg-secondary/70 has-checked:border-primary has-checked:bg-primary/8 has-focus-visible:ring-ring/50 flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-[background-color,border-color] has-focus-visible:ring-3"
                    >
                      <input
                        type="radio"
                        name={`${id}-reason`}
                        value={key}
                        checked={checked}
                        onChange={() => {
                          setReason(key);
                          setError(null);
                        }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          checked ? "border-primary" : "border-border",
                        )}
                      >
                        <span
                          className={cn(
                            "bg-primary size-1.5 rounded-full transition-transform",
                            checked ? "scale-100" : "scale-0",
                          )}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="text-foreground block text-sm font-medium">
                          {REASONS[key].label}
                        </span>
                        <span className="text-muted-foreground block text-xs leading-snug">
                          {REASONS[key].hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Field
              label={
                <>
                  Details <span className="text-muted-foreground font-normal">(optional)</span>
                </>
              }
              htmlFor={`${id}-details`}
              trailing={
                <span className="text-muted-foreground text-xs tabular-nums">
                  {details.length}/{DETAILS_MAX}
                </span>
              }
            >
              <textarea
                id={`${id}-details`}
                rows={3}
                maxLength={DETAILS_MAX}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="What did you see? Anything that helps us check it is useful."
                className={cn(inputClass, "h-auto min-h-20 resize-y py-2 leading-relaxed")}
              />
            </Field>

            <Field
              label={
                <>
                  Your email <span className="text-muted-foreground font-normal">(optional)</span>
                </>
              }
              htmlFor={`${id}-email`}
              hint="Only used if we need more information from you."
              error={emailError}
            >
              <input
                id={`${id}-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={200}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(null);
                }}
                aria-invalid={emailError ? true : undefined}
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/8 text-destructive rounded-xl border px-3 py-2 text-sm"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={status === "sending"}
                className={cn(pill.secondary, pill.small)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "sending"}
                className={cn(pill.primary, pill.small)}
              >
                {status === "sending" && <Loader2 className="animate-spin" aria-hidden />}
                {status === "sending" ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
