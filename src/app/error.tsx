"use client";

import { Link2 } from "lucide-react";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center">
      <Link2 className="text-destructive mb-6 h-12 w-12" />
      <h1 className="text-foreground text-4xl font-extrabold">Something went wrong</h1>
      <p className="text-muted-foreground mt-4 text-lg">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 rounded-[48px] px-8 py-3 text-sm font-semibold shadow-[10px_9px_22px_rgba(20,78,227,0.38)] transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
