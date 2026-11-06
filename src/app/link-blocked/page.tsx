import { ShieldAlert, ShieldX } from "lucide-react";
import { NoticeLayout } from "@/components/public/notice-layout";
import { codeParam } from "@/components/public/params";
import { PillLink } from "@/components/public/pill-link";
import { noticeShortLink } from "@/components/public/request";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link blocked",
  robots: { index: false },
};

/**
 * Shown for links a moderator banned (or whose owner's account was banned).
 * There is deliberately no way through to the destination.
 */
export default async function LinkBlockedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const code = codeParam((await searchParams).code);

  return (
    <NoticeLayout
      tone="red"
      icon={ShieldX}
      title="Link blocked"
      description="This short link was disabled for violating our terms of service, for example by pointing to phishing, malware or spam. For your safety, it can no longer be opened."
      shortLink={await noticeShortLink(code)}
      actions={
        <>
          <PillLink href="/">Back to home</PillLink>
          <PillLink href="/docs#abuse" variant="secondary">
            How we handle abuse
          </PillLink>
        </>
      }
    >
      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/8 p-4 text-left text-sm leading-relaxed text-red-800 dark:text-red-200"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          If a message or post sent you here, treat the rest of it with care. Do not enter passwords
          or payment details on pages it links to.
        </p>
      </div>
    </NoticeLayout>
  );
}
