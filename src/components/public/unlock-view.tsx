"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Hourglass, Loader2, Lock, LockOpen, SearchX } from "lucide-react";
import { NoticeLayout } from "@/components/public/notice-layout";
import { Panel, inputClass, pill } from "@/components/shared/ui-kit";
import { ApiError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface UnlockResult {
  url: string;
  cloaked?: boolean;
  title?: string | null;
}

type Problem =
  | { kind: "password"; message: string }
  | { kind: "gone" | "rate" | "missing" | "network"; message: string };

const SHAKE: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-8px)" },
  { transform: "translateX(7px)" },
  { transform: "translateX(-5px)" },
  { transform: "translateX(3px)" },
  { transform: "translateX(0)" },
];

interface UnlockViewProps {
  code: string;
  displayUrl: string;
  /** The link's preview page (`/{code}+`), where visitors can report it. */
  previewHref: string;
}

/**
 * Password prompt for protected links. The redirect handler sends visitors
 * here with their original query string, which is passed on to the unlock
 * API so UTM parameters and the `qr=1` scan marker survive the detour.
 */
export function UnlockView({ code, displayUrl, previewHref }: UnlockViewProps) {
  const [frame, setFrame] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (frame) document.title = frame.title;
  }, [frame]);

  if (frame) {
    // Cloaked links keep this address in the bar and show the destination
    // in a full-viewport frame (above the floating theme toggle).
    return (
      <iframe
        src={frame.url}
        title={frame.title}
        referrerPolicy="no-referrer"
        allow="fullscreen; clipboard-write; autoplay; encrypted-media; picture-in-picture"
        className="fixed inset-0 z-[100] block h-full w-full border-0 bg-white"
      />
    );
  }

  return (
    <NoticeLayout
      tone="blue"
      icon={Lock}
      title="This link is password protected"
      description="Enter the password to continue to its destination."
      shortLink={displayUrl}
      footnote={
        <>
          Do not have the password? Ask whoever shared this link with you.{" "}
          <a
            href={previewHref}
            className="text-card-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm font-medium underline underline-offset-3 outline-none focus-visible:ring-3"
          >
            Report this link
          </a>
        </>
      }
    >
      <UnlockForm code={code} displayUrl={displayUrl} onCloaked={setFrame} />
    </NoticeLayout>
  );
}

function UnlockForm({
  code,
  displayUrl,
  onCloaked,
}: {
  code: string;
  displayUrl: string;
  onCloaked: (frame: { url: string; title: string }) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "opening">("idle");
  const [problem, setProblem] = useState<Problem | null>(null);

  const busy = status !== "idle";
  const passwordError = problem?.kind === "password" ? problem.message : null;
  const notice = problem && problem.kind !== "password" ? problem : null;

  function rejectPassword(message: string) {
    setProblem({ kind: "password", message });
    const input = inputRef.current;
    input?.focus();
    input?.select();
    const card = cardRef.current;
    if (card && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      card.animate(SHAKE, { duration: 420, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!password) {
      rejectPassword("Enter the password");
      return;
    }

    setStatus("checking");
    setProblem(null);
    try {
      const result = await apiFetch<UnlockResult>("/api/links/unlock", {
        method: "POST",
        json: { code, password, query: window.location.search.replace(/^\?/, "") },
      });
      if (result.cloaked) {
        onCloaked({ url: result.url, title: result.title || displayUrl });
        return;
      }
      setStatus("opening");
      window.location.replace(result.url);
    } catch (err) {
      setStatus("idle");
      if (!(err instanceof ApiError)) {
        setProblem({
          kind: "network",
          message: "Could not reach the server. Check your connection and try again.",
        });
      } else if (err.status === 401) {
        rejectPassword(err.message || "Incorrect password");
      } else if (err.status === 410) {
        setProblem({ kind: "gone", message: err.message });
      } else if (err.status === 429) {
        setProblem({
          kind: "rate",
          message: err.message || "Too many attempts. Please wait a few minutes and try again.",
        });
      } else if (err.status === 404) {
        setProblem({
          kind: "missing",
          message: "This short link does not exist anymore. It may have been deleted.",
        });
      } else {
        setProblem({ kind: "network", message: err.message });
      }
    }
  }

  return (
    <Panel ref={cardRef} className="text-left">
      <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <label htmlFor={`${id}-password`} className="text-card-foreground text-[13px] font-medium">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            ref={inputRef}
            id={`${id}-password`}
            name="password"
            type={visible ? "text" : "password"}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={password}
            readOnly={busy}
            onChange={(event) => {
              setPassword(event.target.value);
              if (problem?.kind === "password") setProblem(null);
            }}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${id}-error` : undefined}
            className={cn(inputClass, "h-11 pr-11")}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {/* Always rendered: a live region must exist before its text changes,
            and the reserved line keeps the button from jumping on error. */}
        <p id={`${id}-error`} role="alert" className="text-destructive mt-1.5 min-h-4 text-xs">
          {passwordError}
        </p>

        {notice && (
          <div
            role="alert"
            className={cn(
              "mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              notice.kind === "missing"
                ? "border-zinc-500/25 bg-zinc-500/8 text-zinc-700 dark:text-zinc-200"
                : "border-amber-500/25 bg-amber-500/8 text-amber-800 dark:text-amber-200",
            )}
          >
            {notice.kind === "missing" ? (
              <SearchX className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{notice.message}</span>
          </div>
        )}

        <button type="submit" disabled={busy} className={cn(pill.primary, "mt-3 h-11 w-full")}>
          {status === "checking" && <Loader2 className="animate-spin" aria-hidden />}
          {status === "opening" && <LockOpen aria-hidden />}
          {status === "checking" ? "Checking…" : status === "opening" ? "Opening…" : "Unlock"}
          {status === "idle" && <ArrowRight aria-hidden />}
        </button>
      </form>
    </Panel>
  );
}
