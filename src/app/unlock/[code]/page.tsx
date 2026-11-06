import { decodeCode } from "@/components/public/params";
import { requestNamespace } from "@/components/public/request";
import { UnlockView } from "@/components/public/unlock-view";
import { buildShortUrl, displayShortUrl } from "@/lib/app-url";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Password protected link",
  robots: { index: false, follow: false },
  // Neither the frame of a cloaked link nor the final redirect should tell
  // the destination which short link (and unlock page) the visitor used.
  referrer: "no-referrer",
};

/**
 * Password prompt for protected links. The redirect handler sends visitors
 * here (on the short link's own host) with the original query string.
 */
export default async function UnlockPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeCode((await params).code);
  const { request, domain } = await requestNamespace();
  const options = { domain: domain || null, request };

  return (
    <UnlockView
      code={code}
      displayUrl={displayShortUrl(code, options)}
      previewHref={`${buildShortUrl(code, options)}+`}
    />
  );
}
