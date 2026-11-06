import { CalendarClock } from "lucide-react";
import { Countdown } from "@/components/public/countdown";
import { NoticeLayout } from "@/components/public/notice-layout";
import { codeParam, firstParam, shortPath } from "@/components/public/params";
import { PillLink } from "@/components/public/pill-link";
import { noticeShortLink } from "@/components/public/request";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coming soon",
  robots: { index: false },
};

function startTime(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Shown for links whose owner set a start date that has not arrived yet (`?at=<ISO>`). */
export default async function LinkScheduledPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = codeParam(params.code);
  const at = startTime(firstParam(params.at));

  return (
    <NoticeLayout
      tone="blue"
      icon={CalendarClock}
      title="Coming soon"
      description={
        at
          ? "This link is not live yet. Its owner scheduled it to open at the time below."
          : "This link is not live yet. Its owner scheduled it to open later, so check back soon."
      }
      shortLink={await noticeShortLink(code)}
      actions={
        <PillLink href="/" variant="secondary">
          Back to home
        </PillLink>
      }
    >
      {at && <Countdown at={at} href={code ? shortPath(code) : null} />}
    </NoticeLayout>
  );
}
