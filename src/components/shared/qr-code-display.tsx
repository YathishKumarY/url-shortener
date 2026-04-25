"use client";

import { useState } from "react";
import { QrCode, Download } from "lucide-react";
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
  const qrUrl = `/api/qr/${shortCode}`;

  function handleDownload() {
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${shortCode}-qr.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
        <QrCode className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <img src={qrUrl} alt={`QR code for ${shortCode}`} className="h-48 w-48 rounded-lg" />
          <p className="text-muted-foreground text-sm">
            {typeof window !== "undefined" ? `${window.location.origin}/${shortCode}` : shortCode}
          </p>
          <Button
            onClick={handleDownload}
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
