import { ArrowRight, SearchX } from "lucide-react";
import { NoticeLayout } from "@/components/public/notice-layout";
import { codeParam } from "@/components/public/params";
import { PillLink } from "@/components/public/pill-link";
import { noticeShortLink } from "@/components/public/request";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link not found",
  robots: { index: false },
};

/**
 * Routable counterpart to `not-found.tsx`.
 *
 * `not-found.tsx` is a convention file compiled to the internal `_not-found`
 * entry, so `/not-found` is not a real URL - it falls through to the
 * `/[shortCode]` handler. This page gives the redirect handler a genuine
 * destination, which is what keeps it from looping back on itself. For the
 * same reason, never link from here (or any notice page) to "/not-found".
 */
export default async function LinkMissingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await searchParams;

  return (
    <NoticeLayout
      tone="blue"
      icon={SearchX}
      title="Link not found"
      description="This short link does not exist. It may have been deleted, or the address was mistyped."
      shortLink={await noticeShortLink(codeParam(code))}
      actions={
        <>
          <PillLink href="/">
            Shorten a new link
            <ArrowRight />
          </PillLink>
          <PillLink href="/" variant="secondary">
            Back to home
          </PillLink>
        </>
      }
    />
  );
}
