import { CopyIconButton } from "@/components/public/copy-button";
import { mono } from "@/components/public/styles";
import { cn } from "@/lib/utils";

/** A single code sample (a response body, a header, a snippet) with a copy button. */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  /** Shown in the header strip, e.g. "Response" or "Node.js". */
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-card/70 shadow-soft overflow-hidden rounded-2xl border",
        className,
      )}
    >
      <div className="border-border/60 bg-secondary/50 flex h-11 items-center justify-between gap-3 border-b pr-1.5 pl-4">
        <span className="text-muted-foreground truncate text-xs font-medium">{label}</span>
        <CopyIconButton text={code} label={`Copy ${label.toLowerCase()}`} size="sm" />
      </div>
      <pre
        tabIndex={0}
        className={cn(
          mono,
          "text-foreground/90 focus-visible:ring-ring/50 overflow-x-auto px-4 py-3.5 text-[13px] leading-6 outline-none focus-visible:ring-3 focus-visible:ring-inset",
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
