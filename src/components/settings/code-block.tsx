"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";

/** Monospace snippet with a copy button. */
export function CodeBlock({
  code,
  className,
  label,
}: {
  code: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn(
        "border-border/70 bg-background/70 relative overflow-hidden rounded-xl border",
        className,
      )}
    >
      {label && (
        <div className="border-border/60 text-muted-foreground border-b px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase">
          {label}
        </div>
      )}
      <pre className="text-card-foreground overflow-x-auto p-3 pr-12 font-mono text-[12px] leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy code"}
        onClick={async () => {
          await copyToClipboard(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="border-border bg-secondary text-card-foreground hover:text-foreground absolute right-2 bottom-2 flex size-8 cursor-pointer items-center justify-center rounded-lg border transition-colors"
      >
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

/** A value with a copy button, for DNS records, keys and secrets. */
export function CopyField({
  value,
  mono = true,
  masked = false,
}: {
  value: string;
  mono?: boolean;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);
  return (
    <div className="border-border bg-background/60 flex min-w-0 items-center gap-1 rounded-lg border py-1 pr-1 pl-2.5">
      <span
        className={cn("text-foreground min-w-0 flex-1 truncate text-[12px]", mono && "font-mono")}
      >
        {revealed ? value : "•".repeat(Math.min(32, value.length))}
      </span>
      {masked && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="text-muted-foreground hover:text-foreground cursor-pointer rounded-md px-1.5 text-[11px] font-medium"
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
      )}
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy"}
        onClick={async () => {
          await copyToClipboard(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-muted-foreground hover:text-foreground hover:bg-secondary flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md"
      >
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
