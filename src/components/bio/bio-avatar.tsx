"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface BioAvatarProps {
  /** A pre-validated http(s) URL, or null for the initials fallback. */
  src: string | null;
  initials: string;
  className?: string;
  /** Outline colour for the photo (pure black or white at low opacity). */
  imageClassName?: string;
  fallbackClassName?: string;
}

/**
 * Profile photo with an initials fallback for missing or broken images.
 *
 * Decorative (`alt=""`): the display name is rendered as the heading right
 * below it. The failure is keyed by URL so typing a new URL in the editor
 * retries automatically.
 */
export function BioAvatar({
  src,
  initials,
  className,
  imageClassName,
  fallbackClassName,
}: BioAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // An image that failed before hydration never fires onError on the client.
  const detectEarlyFailure = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) setFailedSrc(img.getAttribute("src"));
  }, []);

  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full font-semibold tracking-wide select-none",
          className,
          fallbackClassName,
        )}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={detectEarlyFailure}
      src={src}
      alt=""
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn(
        "rounded-full bg-black/10 object-cover outline-1 -outline-offset-1",
        className,
        imageClassName,
      )}
    />
  );
}
