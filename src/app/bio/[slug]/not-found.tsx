import Link from "next/link";
import { ArrowLeft, AtSign, Sparkles } from "lucide-react";
import { BioBackdrop } from "@/components/bio/bio-profile";
import { getBioTheme } from "@/components/bio/themes";
import { LinklyIcon } from "@/components/shared/linkly-icon";

/** Shown for unknown, unpublished or suspended handles, in the brand theme. */
export default function BioNotFound() {
  const theme = getBioTheme("midnight");
  const button =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold outline-none transition-[background-color,box-shadow,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.96] [&_svg]:size-4";

  return (
    <div
      className="relative isolate flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center text-white antialiased"
      style={{ colorScheme: theme.scheme }}
    >
      <BioBackdrop theme={theme} className="fixed" />

      <main className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:animation-duration-500 flex max-w-md flex-col items-center">
        <div className="relative mb-8">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-linear-to-br from-[#144ee3] to-[#eb568e] opacity-50 blur-2xl"
          />
          <div className="relative flex size-24 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/15 backdrop-blur-xl ring-inset">
            <AtSign aria-hidden className="size-10 text-white/85" strokeWidth={1.75} />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-balance">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-pretty text-[#c9ced6]">
          The handle may have changed, or the page isn&apos;t public right now. Double-check the
          link you followed.
        </p>

        <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/"
            className={`${button} shadow-blue bg-[#144ee3] text-white hover:bg-[#2a5ff0]`}
          >
            <ArrowLeft aria-hidden /> Go to Linkly
          </Link>
          <Link
            href="/dashboard/bio"
            className={`${button} bg-white/[0.06] text-white ring-1 ring-white/15 backdrop-blur-xl ring-inset hover:bg-white/[0.12]`}
          >
            <Sparkles aria-hidden /> Create your own page
          </Link>
        </div>
      </main>

      <p className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2 text-[13px] text-white/60">
        <LinklyIcon className="size-4" />
        Linkly
      </p>
    </div>
  );
}
