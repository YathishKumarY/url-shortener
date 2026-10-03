import Link from "next/link";
import { LinkIcon, ArrowRight, SearchX } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link Not Found",
};

/**
 * Routable counterpart to `not-found.tsx`.
 *
 * `not-found.tsx` is a convention file compiled to the internal `_not-found`
 * entry, so `/not-found` is not a real URL - it falls through to the
 * `/[shortCode]` handler. This page gives the redirect handler a genuine
 * destination, which is what keeps it from looping back on itself.
 */
export default async function LinkMissingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-[#144ee3]/5 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-[#eb568e]/5 blur-[100px]" />
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <div className="relative mb-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#144ee3]/10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#144ee3]/15">
              <SearchX className="text-primary h-8 w-8" />
            </div>
          </div>
        </div>

        <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          Link Not Found
        </h1>

        <p className="text-muted-foreground mt-4 max-w-sm text-base leading-relaxed">
          This shortened link does not exist. It may have been deleted, or the address was mistyped.
        </p>

        {code && (
          <div className="mt-8 w-full rounded-xl bg-[#144ee3]/5 p-4 dark:bg-[#144ee3]/10">
            <div className="flex items-center justify-center gap-2">
              <LinkIcon className="text-primary h-4 w-4" />
              <span className="text-muted-foreground font-mono text-sm break-all">/{code}</span>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="bg-primary shadow-blue hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-[48px] px-8 text-sm font-semibold text-white transition-[background-color,transform] duration-150 active:scale-[0.96]"
          >
            Shorten a New Link
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="border-border bg-secondary text-foreground hover:bg-secondary/80 inline-flex h-11 items-center justify-center rounded-[48px] border px-8 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.96]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
