"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { pill } from "@/components/shared/ui-kit";
import { cn, copyToClipboard } from "@/lib/utils";

const ICON_MOTION =
  "absolute transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]";

/** Round icon button that copies `text`, with a check-mark confirmation. */
export function CopyIconButton({
  text,
  label = "Copy",
  toastMessage,
  size = "default",
  className,
}: {
  text: string;
  /** Accessible name and tooltip, e.g. "Copy short link". */
  label?: string;
  /** Also confirm with a toast (for copies that matter, like a short link). */
  toastMessage?: string;
  /** `sm` is a borderless variant for toolbars such as code block headers. */
  size?: "default" | "sm";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleCopy() {
    if (!(await copyToClipboard(text))) {
      toast.error("Could not copy. Select the text and copy it manually.");
      return;
    }
    setCopied(true);
    if (toastMessage) toast.success(toastMessage);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className={cn(
        pill.icon,
        "relative",
        size === "sm" && "hover:bg-secondary size-8 border-transparent bg-transparent",
        className,
      )}
    >
      <Copy
        aria-hidden
        className={cn(
          ICON_MOTION,
          copied ? "scale-50 opacity-0 blur-[2px]" : "scale-100 opacity-100",
        )}
      />
      <Check
        aria-hidden
        className={cn(
          ICON_MOTION,
          "text-success",
          copied ? "scale-100 opacity-100" : "scale-50 opacity-0 blur-[2px]",
        )}
      />
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
