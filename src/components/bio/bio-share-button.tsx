"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share } from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";

const ICON_TRANSITION =
  "absolute size-[18px] transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]";

/**
 * Share the page: the native share sheet on touch devices, otherwise copy
 * the URL. Built from the canonical `/@handle` path so it is right however
 * the visitor arrived.
 */
export function BioShareButton({
  path,
  title,
  className,
}: {
  path: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  async function handleShare() {
    const url = new URL(path, window.location.origin).toString();
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // Dismissing the sheet is not an error; anything else falls back to copying.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (await copyToClipboard(url)) {
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label={copied ? "Link copied" : "Share this page"}
        title="Share"
        className={cn(
          "relative flex size-11 cursor-pointer items-center justify-center rounded-full transition-[translate,scale,background-color,color,box-shadow] duration-200 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.96]",
          className,
        )}
      >
        <Share
          aria-hidden
          className={cn(
            ICON_TRANSITION,
            copied ? "scale-25 opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-[0px]",
          )}
        />
        <Check
          aria-hidden
          className={cn(
            ICON_TRANSITION,
            copied ? "scale-100 opacity-100 blur-[0px]" : "scale-25 opacity-0 blur-[4px]",
          )}
        />
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </>
  );
}
