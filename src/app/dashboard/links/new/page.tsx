"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LinkForm } from "@/components/links/link-form";
import { PageHeader, pill } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

function NewLink() {
  const params = useSearchParams();
  // `url` from the bookmarklet/extension; `text` from the PWA share target,
  // where Android often puts the shared link inside free text.
  const initialUrl = params.get("url") ?? params.get("text")?.match(/https?:\/\/\S+/)?.[0] ?? "";

  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-8">
      <PageHeader
        title="Create a link"
        description="Shorten a URL and add as much power as you need: passwords, expiry, targeting, A/B tests, social previews."
        actions={
          <Link href="/dashboard" className={cn(pill.secondary, pill.small)}>
            <ArrowLeft /> All links
          </Link>
        }
      />
      <LinkForm mode="create" initialUrl={initialUrl} />
    </div>
  );
}

export default function NewLinkPage() {
  return (
    <Suspense>
      <NewLink />
    </Suspense>
  );
}
