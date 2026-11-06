"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  CornerDownRight,
  Download,
  ExternalLink,
  QrCode,
  Settings2,
  Share,
} from "lucide-react";
import { toast } from "sonner";
import { PERIOD_OPTIONS, StatsSkeleton, StatsView } from "@/components/analytics/stats-view";
import { LinkActionsMenu } from "@/components/dashboard/link-actions";
import { CopyIconButton, linkFeatures } from "@/components/dashboard/link-row";
import { ActivityTable } from "@/components/links/activity-table";
import { LinkForm } from "@/components/links/link-form";
import { QrDesigner } from "@/components/links/qr-designer";
import {
  EmptyState,
  Favicon,
  pill,
  Segmented,
  StatusBadge,
  TagChip,
} from "@/components/shared/ui-kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useLinkStats } from "@/hooks/use-analytics";
import { useLink } from "@/hooks/use-links";
import { downloadFrom } from "@/lib/api-client";
import { formatDate, hostnameOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "settings", label: "Settings", icon: Settings2 },
  { value: "qr", label: "QR code", icon: QrCode },
  { value: "activity", label: "Activity", icon: Activity },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function AnalyticsTab({ linkId }: { linkId: string }) {
  const [period, setPeriod] = useState("7d");
  const [includeBots, setIncludeBots] = useState(false);
  const { data, isLoading, isFetching } = useLinkStats(linkId, period, includeBots);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <div className="flex items-center gap-3">
          <label className="text-card-foreground flex cursor-pointer items-center gap-2 text-[13px]">
            <Bot className="text-muted-foreground size-4" />
            Include bots
            <Switch checked={includeBots} onCheckedChange={setIncludeBots} size="sm" />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(pill.secondary, pill.small)}>
              <Download /> Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => downloadFrom(`/api/links/${linkId}/clicks?format=csv`)}
              >
                Raw clicks (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => downloadFrom(`/api/links/${linkId}/clicks?format=json`)}
              >
                Raw clicks (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className={cn("transition-opacity", isFetching && !isLoading && "opacity-70")}>
        {isLoading || !data ? <StatsSkeleton /> : <StatsView stats={data} scope="link" />}
      </div>
    </div>
  );
}

function LinkDetail({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ?? "analytics") as TabValue;
  const { data: link, isLoading, error } = useLink(id);

  function setTab(next: string) {
    const query = new URLSearchParams(params.toString());
    if (next === "analytics") query.delete("tab");
    else query.set("tab", next);
    router.replace(query.size ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <StatsSkeleton />
      </div>
    );
  }

  if (error || !link) {
    return (
      <EmptyState
        icon={ExternalLink}
        title="Link not found"
        description="It may have been deleted, or it belongs to another account."
        action={
          <Link href="/dashboard" className={pill.primary}>
            Back to links
          </Link>
        }
      />
    );
  }

  const features = linkFeatures(link);

  async function share() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: link.title ?? link.displayUrl, url: link.shortUrl });
      } catch {
        // dismissed
      }
    } else {
      await navigator.clipboard?.writeText(link.shortUrl);
      toast.success("Copied to clipboard");
    }
  }

  return (
    <>
      <div className="border-border/60 bg-card/70 shadow-soft mb-5 rounded-2xl border p-5 backdrop-blur-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <Favicon url={link.originalUrl} size={32} className="size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground truncate text-xl font-bold tracking-tight">
                {link.title || hostnameOf(link.originalUrl)}
              </h1>
              <StatusBadge status={link.status} />
              {link.archived && (
                <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                  Archived
                </span>
              )}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <a
                href={link.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary truncate text-[15px] font-semibold hover:underline"
              >
                {link.displayUrl}
              </a>
              <CopyIconButton text={link.shortUrl} />
            </div>
            <a
              href={link.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground mt-0.5 flex min-w-0 items-center gap-1 text-[13px]"
            >
              <CornerDownRight className="size-3.5 shrink-0" />
              <span className="truncate">{link.originalUrl}</span>
            </a>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {link.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} color={tag.color} />
              ))}
              {features.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="bg-secondary text-muted-foreground inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium"
                >
                  <Icon className="size-3" />
                  {label}
                </span>
              ))}
              <span className="text-muted-foreground text-xs">
                Created {formatDate(link.createdAt)}
              </span>
            </div>
            {link.banned && (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                A moderator disabled this link{link.bannedReason ? `: ${link.bannedReason}` : ""}.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className={pill.secondary} onClick={share}>
              <Share /> Share
            </button>
            <LinkActionsMenu link={link} onDeleted={() => router.push("/dashboard")} />
          </div>
        </div>
      </div>

      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({
            value: t.value,
            label: (
              <span className="flex items-center gap-1.5">
                <t.icon className="size-3.5" />
                {t.label}
              </span>
            ),
          }))}
        />
      </div>

      {tab === "analytics" && <AnalyticsTab linkId={link.id} />}
      {tab === "settings" && (
        <LinkForm
          key={link.id}
          mode="edit"
          link={link}
          onSaved={(updated) =>
            updated.id !== link.id && router.replace(`/dashboard/links/${updated.id}`)
          }
        />
      )}
      {tab === "qr" && <QrDesigner link={link} />}
      {tab === "activity" && (
        <ActivityTable
          linkId={link.id}
          showDestination={!!(link.abVariants || link.geoTargets || link.iosUrl || link.androidUrl)}
        />
      )}
    </>
  );
}

export default function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-8">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> All links
      </Link>
      <Suspense>
        <LinkDetail id={id} />
      </Suspense>
    </div>
  );
}
