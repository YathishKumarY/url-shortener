import { CirclePause, RotateCw } from "lucide-react";
import { NoticeLayout, NoticeSteps } from "@/components/public/notice-layout";
import { codeParam, shortPath } from "@/components/public/params";
import { PillLink } from "@/components/public/pill-link";
import { noticeShortLink } from "@/components/public/request";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link paused",
  robots: { index: false },
};

/** Shown for links their owner has switched off (`disabled`). */
export default async function LinkDisabledPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const code = codeParam((await searchParams).code);

  return (
    <NoticeLayout
      tone="gray"
      icon={CirclePause}
      title="Link paused"
      description="The owner of this short link has paused it, so it is not sending visitors anywhere right now."
      shortLink={await noticeShortLink(code)}
      actions={
        <>
          {code && (
            <PillLink href={shortPath(code)} native>
              <RotateCw />
              Try again
            </PillLink>
          )}
          <PillLink href="/" variant="secondary">
            Back to home
          </PillLink>
        </>
      }
    >
      <NoticeSteps
        steps={[
          "Check back later. Paused links can be switched back on at any time.",
          "Ask the person who shared it for another way to reach the page",
        ]}
      />
    </NoticeLayout>
  );
}
