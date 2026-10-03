import Link from "next/link";
import { Clock, LinkIcon, ArrowRight, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link Expired",
};

export default async function LinkExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-[#eb568e]/5 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-[#144ee3]/5 blur-[100px]" />
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        {/* Animated icon */}
        <div className="relative mb-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#eb568e]/10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eb568e]/15">
              <Clock className="h-8 w-8 text-[#eb568e]" />
            </div>
          </div>
          <div className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#b0901e]/20">
            <ShieldAlert className="h-4 w-4 text-[#b0901e]" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          Link Expired
        </h1>

        <p className="text-muted-foreground mt-4 max-w-sm text-base leading-relaxed">
          This shortened link is no longer active. The owner set an expiration date and it has
          passed.
        </p>

        {/* Info card */}
        {code && (
          <div className="mt-8 w-full rounded-xl bg-[#eb568e]/5 p-4 dark:bg-[#eb568e]/10">
            <div className="flex items-center justify-center gap-2">
              <LinkIcon className="h-4 w-4 text-[#eb568e]" />
              <span className="text-muted-foreground font-mono text-sm">/{code}</span>
            </div>
          </div>
        )}

        {/* What can you do section */}
        <div className="mt-8 w-full space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            What you can do
          </p>
          <div className="space-y-2 text-left">
            <div className="bg-card flex items-start gap-3 rounded-lg p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)]">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#144ee3]/10">
                <span className="text-xs font-bold text-[#144ee3]">1</span>
              </div>
              <p className="text-card-foreground text-sm">
                Contact the person who shared this link for an updated URL
              </p>
            </div>
            <div className="bg-card flex items-start gap-3 rounded-lg p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)]">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#144ee3]/10">
                <span className="text-xs font-bold text-[#144ee3]">2</span>
              </div>
              <p className="text-card-foreground text-sm">
                Create your own short links with custom expiration dates
              </p>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
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
