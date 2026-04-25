import Link from "next/link";
import { Link2 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center">
      <Link2 className="text-primary mb-6 h-12 w-12" />
      <h1 className="text-foreground text-6xl font-extrabold">404</h1>
      <p className="text-muted-foreground mt-4 text-lg">
        This link doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 rounded-[48px] px-8 py-3 text-sm font-semibold shadow-[10px_9px_22px_rgba(20,78,227,0.38)] transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
