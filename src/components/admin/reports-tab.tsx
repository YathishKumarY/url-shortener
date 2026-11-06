"use client";

import { useState } from "react";
import { ArrowRight, Ban, CircleCheck, Eye, Flag, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { BanLinkDialog, ErrorState, RowsSkeleton } from "@/components/admin/admin-shared";
import { EmptyState, Favicon, Panel, Segmented, pill } from "@/components/shared/ui-kit";
import {
  useAdminReports,
  useBanAdminLink,
  useResolveAdminReport,
  type AdminReport,
  type ReportReason,
} from "@/hooks/use-admin";
import { hostnameOf, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const REASONS: Record<ReportReason, { label: string; className: string }> = {
  phishing: {
    label: "Phishing",
    className: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300",
  },
  malware: {
    label: "Malware",
    className: "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-300",
  },
  spam: {
    label: "Spam",
    className: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  illegal: {
    label: "Illegal",
    className: "bg-purple-500/12 text-purple-700 ring-purple-500/25 dark:text-purple-300",
  },
  other: {
    label: "Other",
    className: "bg-zinc-500/12 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300",
  },
};

function ReasonBadge({ reason }: { reason: ReportReason }) {
  const { label, className } = REASONS[reason] ?? REASONS.other;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset",
        className,
      )}
    >
      {label}
    </span>
  );
}

function displayShort(report: AdminReport) {
  return report.link.shortUrl.replace(/^https?:\/\//, "");
}

function ReportCard({
  report,
  busy,
  onBan,
  onResolve,
}: {
  report: AdminReport;
  busy: boolean;
  onBan: () => void;
  onResolve: (resolved: boolean) => void;
}) {
  const { link } = report;
  const alreadyBanned = !!link.bannedAt;
  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ReasonBadge reason={report.reason} />
        {alreadyBanned && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-red-500/12 px-2 text-xs font-medium text-red-700 ring-1 ring-red-500/25 ring-inset dark:text-red-300">
            <Ban className="size-3" />
            Link banned
          </span>
        )}
        <span className="text-muted-foreground text-xs">
          {report.email ? `Reported by ${report.email}` : "Reported anonymously"} -{" "}
          {timeAgo(report.createdAt)}
        </span>
      </div>

      {report.details && (
        <p className="text-card-foreground mt-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {report.details}
        </p>
      )}

      <div className="border-border/60 bg-secondary/40 mt-3 flex items-center gap-3 rounded-xl border p-3">
        <Favicon url={link.originalUrl} size={32} className="size-9" />
        <div className="min-w-0 flex-1">
          <a
            href={link.shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary focus-visible:ring-ring/50 block truncate rounded text-sm font-semibold outline-none focus-visible:ring-2"
          >
            {displayShort(report)}
          </a>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <ArrowRight className="size-3 shrink-0" />
            <span className="truncate" title={link.originalUrl}>
              {hostnameOf(link.originalUrl)}
            </span>
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs" title={link.originalUrl}>
            {link.originalUrl}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            Owner: {link.user ? link.user.email : "Anonymous"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <a
          href={`${link.shortUrl}+`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(pill.ghost, pill.small)}
        >
          <Eye />
          Preview
        </a>
        {report.resolved ? (
          <button
            type="button"
            className={cn(pill.secondary, pill.small)}
            onClick={() => onResolve(false)}
            disabled={busy}
          >
            <RotateCcw />
            Reopen
          </button>
        ) : (
          <>
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() => onResolve(true)}
              disabled={busy}
            >
              <X />
              Dismiss
            </button>
            {!alreadyBanned && (
              <button
                type="button"
                className={cn(pill.danger, pill.small)}
                onClick={onBan}
                disabled={busy}
              >
                <Ban />
                Ban link
              </button>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

export function ReportsTab() {
  const [view, setView] = useState<"open" | "resolved">("open");
  const { data, isLoading, isError, error, refetch } = useAdminReports(view === "resolved");
  const [banTarget, setBanTarget] = useState<AdminReport | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ban = useBanAdminLink();
  const resolve = useResolveAdminReport();

  async function resolveReport(report: AdminReport, resolved: boolean) {
    setBusyId(report.id);
    try {
      await resolve.mutateAsync({ id: report.id, resolved });
      toast.success(resolved ? "Report dismissed" : "Report reopened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function banLink(report: AdminReport, reason: string) {
    try {
      await ban.mutateAsync({ id: report.link.id, banned: true, reason });
      toast.success(`${displayShort(report)} was banned`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: "Open", count: view === "open" ? data?.length : undefined },
            {
              value: "resolved",
              label: "Resolved",
              count: view === "resolved" ? data?.length : undefined,
            },
          ]}
        />
      </div>

      {isLoading ? (
        <RowsSkeleton rows={3} tall />
      ) : isError || !data ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={view === "open" ? CircleCheck : Flag}
          title={view === "open" ? "No open reports" : "No resolved reports"}
          description={
            view === "open"
              ? "Nothing needs review right now. New reports from the public report form show up here."
              : "Dismissed and actioned reports are kept here."
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.map((report) => (
            <li key={report.id}>
              <ReportCard
                report={report}
                busy={busyId === report.id}
                onBan={() => setBanTarget(report)}
                onResolve={(resolved) => void resolveReport(report, resolved)}
              />
            </li>
          ))}
        </ul>
      )}

      <BanLinkDialog
        open={!!banTarget}
        onOpenChange={(open) => !open && setBanTarget(null)}
        target={banTarget ? displayShort(banTarget) : ""}
        defaultReason={banTarget ? `Reported: ${banTarget.reason}` : "Violation of terms"}
        onConfirm={(reason) => (banTarget ? banLink(banTarget, reason) : undefined)}
      />
    </div>
  );
}
