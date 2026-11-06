"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { hostnameOf } from "@/lib/format";

interface SocialPreviewProps {
  title: string;
  description: string;
  image: string;
  domain: string;
}

/** How the link unfurls in chat apps and social feeds. */
export function SocialPreview({ title, description, image, domain }: SocialPreviewProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = image && failedSrc !== image;

  return (
    <div className="border-border/70 bg-background/60 overflow-hidden rounded-xl border">
      <div className="bg-secondary relative aspect-[1.91/1] w-full overflow-hidden">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="size-full object-cover"
            onError={() => setFailedSrc(image)}
          />
        ) : (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1.5 text-xs">
            <ImageIcon className="size-6" />
            No preview image
          </div>
        )}
      </div>
      <div className="space-y-0.5 px-3 py-2.5">
        <p className="text-muted-foreground truncate text-[11px] tracking-wide uppercase">
          {hostnameOf(`https://${domain}`)}
        </p>
        <p className="text-foreground line-clamp-2 text-sm leading-snug font-semibold">
          {title || "Page title"}
        </p>
        <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
          {description || "A short description of the page appears here."}
        </p>
      </div>
    </div>
  );
}
