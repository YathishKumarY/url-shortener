"use client";

import { useCallback, useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

/** A link's favicon on its light chip, with a globe when it cannot load. */
export function BioFavicon({ src, className }: { src: string | null; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const detectEarlyFailure = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) setFailedSrc(img.getAttribute("src"));
  }, []);

  if (!src || failedSrc === src) {
    return <Globe aria-hidden className={cn("size-5 text-[#5b6170]", className)} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={detectEarlyFailure}
      src={src}
      alt=""
      width={22}
      height={22}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn("size-[22px] rounded-[5px] object-contain", className)}
    />
  );
}
