"use client";

import { useState } from "react";
import { QrCode, Download, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function QrCodeDisplay({ shortCode }: { shortCode: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  // Resolved on open rather than during render: reading window.location in the
  // render path produces different server and client output (a hydration
  // mismatch), and the dialog is the only place the value is shown.
  const [shortUrl, setShortUrl] = useState("");

  const qrUrl = `/api/qr/${shortCode}`;

  function handleDownload() {
    const a = document.createElement("a");
    // The route sets Content-Disposition: attachment for download=1, which is
    // what actually forces a save; the `download` attribute alone does not
    // survive every browser's handling of a route response.
    a.href = `${qrUrl}?download=1`;
    a.download = `${shortCode}-qr.png`;
    a.rel = "noopener";
    // Firefox and Safari ignore a click on an element that is not in the
    // document, so attach it for the duration of the click.
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          setStatus("loading");
          setShortUrl(`${window.location.origin}/${shortCode}`);
        }
      }}
    >
      <DialogTrigger
        aria-label={`Show QR code for ${shortCode}`}
        title="Show QR code"
        className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        <QrCode className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {/* White plate: the symbol needs a light surround to stay scannable
              in dark mode, and rounded corners must not clip the quiet zone. */}
          <div className="relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-lg bg-white">
            {status === "loading" && (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            )}
            {status === "error" && (
              <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 text-center">
                <ImageOff className="h-6 w-6" />
                <span className="text-xs">Could not load QR code</span>
              </div>
            )}
            {open && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrUrl}
                alt={`QR code linking to the short URL for ${shortCode}`}
                width={192}
                height={192}
                onLoad={() => setStatus("loaded")}
                onError={() => setStatus("error")}
                className={`h-48 w-48 ${status === "loaded" ? "block" : "hidden"}`}
              />
            )}
          </div>
          <p className="text-muted-foreground text-sm break-all">{shortUrl || `/${shortCode}`}</p>
          <Button
            onClick={handleDownload}
            disabled={status !== "loaded"}
            className="bg-primary text-primary-foreground rounded-lg"
          >
            <Download className="mr-2 h-4 w-4" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
