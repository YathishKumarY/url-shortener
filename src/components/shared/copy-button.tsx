"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      title="Copy to clipboard"
      className="text-muted-foreground hover:text-foreground relative h-8 w-8"
    >
      <Copy
        className="absolute h-4 w-4 transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{
          opacity: copied ? 0 : 1,
          transform: copied ? "scale(0.25)" : "scale(1)",
          filter: copied ? "blur(4px)" : "blur(0px)",
        }}
      />
      <Check
        className="text-success absolute h-4 w-4 transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{
          opacity: copied ? 1 : 0,
          transform: copied ? "scale(1)" : "scale(0.25)",
          filter: copied ? "blur(0px)" : "blur(4px)",
        }}
      />
    </Button>
  );
}
