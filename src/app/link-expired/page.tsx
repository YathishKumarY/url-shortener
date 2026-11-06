import { ArrowRight, Clock, MousePointerClick, ShieldAlert } from "lucide-react";
import { NoticeLayout, NoticeSteps } from "@/components/public/notice-layout";
import { codeParam, firstParam } from "@/components/public/params";
import { PillLink } from "@/components/public/pill-link";
import { noticeShortLink } from "@/components/public/request";
import type { Metadata } from "next";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Where the redirect handler sends visitors of a link that can no longer be
 * opened: `?reason=expired` (past its expiry date, the default) or
 * `?reason=limit` (click limit reached, including one-time links).
 */
const COPY = {
  expired: {
    title: "Link expired",
    icon: Clock,
    description:
      "This short link is no longer active. Its owner set an expiration date, and that date has passed.",
    steps: [
      "Ask the person who shared this link for an updated URL",
      "Create your own short links with custom expiration dates",
    ],
  },
  limit: {
    title: "Click limit reached",
    icon: MousePointerClick,
    description:
      "This short link has been opened as many times as its owner allowed. If it was a one-time link, someone has already used it.",
    steps: [
      "Ask the person who shared this link to send you a new one",
      "Create your own one-time or click-limited links",
    ],
  },
} as const;

function reasonOf(value: string | string[] | undefined): keyof typeof COPY {
  return firstParam(value) === "limit" ? "limit" : "expired";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { reason } = await searchParams;
  return { title: COPY[reasonOf(reason)].title, robots: { index: false } };
}

export default async function LinkExpiredPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const copy = COPY[reasonOf(params.reason)];

  return (
    <NoticeLayout
      tone="pink"
      icon={copy.icon}
      badge={ShieldAlert}
      badgeTone="amber"
      title={copy.title}
      description={copy.description}
      shortLink={await noticeShortLink(codeParam(params.code))}
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
    >
      <NoticeSteps steps={[...copy.steps]} />
    </NoticeLayout>
  );
}
