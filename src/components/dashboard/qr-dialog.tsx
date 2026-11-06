"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ImageOff, Loader2, Palette } from "lucide-react";
import { pill } from "@/components/shared/ui-kit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadFrom } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function qrImageUrl(
  shortCode: string,
  domain: string | null,
  extra: Record<string, string> = {},
) {
  const params = new URLSearchParams({ ...(domain ? { domain } : {}), ...extra });
  const query = params.toString();
  return `/api/qr/${encodeURIComponent(shortCode)}${query ? `?${query}` : ""}`;
}

interface QrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Owner's link id; enables the 'customize' shortcut to the designer. */
  linkId?: string;
  shortCode: string;
  domain: string | null;
  displayUrl: string;
}

/** Quick QR view with downloads; the full designer lives on the link page. */
export function QrDialog({
  open,
  onOpenChange,
  linkId,
  shortCode,
  domain,
  displayUrl,
}: QrDialogProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const src = qrImageUrl(shortCode, domain, { size: "512" });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setStatus("loading");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {/* White plate: the symbol needs a light surround to stay scannable in dark mode. */}
          <div className="relative flex size-56 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-inner">
            {status === "loading" && <Loader2 className="size-6 animate-spin text-zinc-400" />}
            {status === "error" && (
              <div className="flex flex-col items-center gap-2 text-zinc-500">
                <ImageOff className="size-6" />
                <span className="text-xs">Could not load QR code</span>
              </div>
            )}
            {open && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src}
                alt={`QR code for ${displayUrl}`}
                width={208}
                height={208}
                onLoad={() => setStatus("loaded")}
                onError={() => setStatus("error")}
                className={cn("size-52", status === "loaded" ? "block" : "hidden")}
              />
            )}
          </div>
          <p className="text-muted-foreground text-center text-sm break-all">{displayUrl}</p>
          <p className="text-muted-foreground -mt-2 text-center text-xs">
            Scans are tracked separately from clicks in your analytics.
          </p>
          <div className="flex w-full gap-2">
            <button
              type="button"
              className={cn(pill.primary, pill.small, "flex-1")}
              disabled={status !== "loaded"}
              onClick={() =>
                downloadFrom(qrImageUrl(shortCode, domain, { size: "1024", download: "1" }))
              }
            >
              <Download /> PNG
            </button>
            <button
              type="button"
              className={cn(pill.secondary, pill.small, "flex-1")}
              disabled={status !== "loaded"}
              onClick={() =>
                downloadFrom(qrImageUrl(shortCode, domain, { format: "svg", download: "1" }))
              }
            >
              <Download /> SVG
            </button>
          </div>
          {linkId && (
            <Link
              href={`/dashboard/links/${linkId}?tab=qr`}
              className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <Palette className="size-4" /> Customize colors and logo
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
