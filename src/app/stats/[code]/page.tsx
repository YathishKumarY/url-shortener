import { Footer } from "@/components/landing/footer";
import { NoticeBackdrop } from "@/components/public/notice-layout";
import { decodeCode, domainParam } from "@/components/public/params";
import { PublicStats } from "@/components/public/public-stats";
import { incomingRequest } from "@/components/public/request";
import { Navbar } from "@/components/shared/navbar";
import { buildShortUrl, displayShortUrl } from "@/lib/app-url";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolve({ params, searchParams }: PageProps) {
  const code = decodeCode((await params).code);
  // Links on a custom domain pass it explicitly: this page may be opened on
  // the app's own host, which cannot tell namespaces apart by itself.
  const domain = domainParam((await searchParams).domain);
  const options = { domain: domain || null, request: await incomingRequest() };
  return {
    code,
    domain,
    shortUrl: buildShortUrl(code, options),
    displayUrl: displayShortUrl(code, options),
  };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { displayUrl } = await resolve(props);
  return { title: `Stats for ${displayUrl}`, robots: { index: false } };
}

/** Public analytics for links whose owner enabled `publicStats` (`/stats/{code}`). */
export default async function PublicStatsPage(props: PageProps) {
  const { code, domain, shortUrl, displayUrl } = await resolve(props);

  return (
    <div className="bg-background relative flex min-h-dvh flex-col overflow-x-clip">
      <NoticeBackdrop tone="blue" />
      <Navbar />
      <main className="relative z-10 flex-1 px-4 pb-24 sm:px-6 md:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <PublicStats
            code={code}
            domain={domain}
            shortUrl={shortUrl}
            displayUrl={displayUrl}
            previewHref={`${shortUrl}+`}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
