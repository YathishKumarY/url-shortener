"use client";

import { useState } from "react";
import { Ban, Eye, Flag, Link2, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BanLinkDialog,
  ErrorState,
  Pagination,
  RowsSkeleton,
  SearchInput,
  useDebounced,
  usePage,
} from "@/components/admin/admin-shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, Favicon, Panel, Segmented, StatusBadge } from "@/components/shared/ui-kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAdminLinks,
  useBanAdminLink,
  useDeleteAdminLink,
  type AdminLink,
  type AdminLinkFilter,
} from "@/hooks/use-admin";
import { formatNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ value: AdminLinkFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "reported", label: "Reported" },
  { value: "banned", label: "Banned" },
  { value: "anonymous", label: "Anonymous" },
];

const EMPTY_COPY: Record<AdminLinkFilter, string> = {
  all: "Links will appear here once they are created.",
  reported: "No links have open reports.",
  banned: "No links are banned.",
  anonymous: "No anonymous links exist.",
};

function LinkRow({
  link,
  onBan,
  onUnban,
  onDelete,
}: {
  link: AdminLink;
  onBan: () => void;
  onUnban: () => void;
  onDelete: () => void;
}) {
  return (
    <Panel className={cn("p-4", link.banned && "border-red-500/30 bg-red-500/5")}>
      <div className="flex items-start gap-3">
        <Favicon url={link.originalUrl} size={32} className="mt-0.5 size-9" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href={link.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary focus-visible:ring-ring/50 min-w-0 truncate rounded text-sm font-semibold outline-none focus-visible:ring-2"
            >
              {link.displayUrl}
            </a>
            <StatusBadge status={link.status} />
            {link.reportCount > 0 && (
              <span
                className="inline-flex h-6 items-center gap-1 rounded-full bg-pink-500/12 px-2 text-xs font-medium text-pink-700 tabular-nums ring-1 ring-pink-500/25 ring-inset dark:text-pink-300"
                title={`${link.reportCount} open ${link.reportCount === 1 ? "report" : "reports"}`}
              >
                <Flag className="size-3" />
                {link.reportCount}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-[13px]" title={link.originalUrl}>
            {link.originalUrl}
          </p>
          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span className="max-w-full truncate">
              {link.owner ? link.owner.email : "Anonymous"}
            </span>
            <span className="tabular-nums">
              {formatNumber(link.clickCount)} {link.clickCount === 1 ? "click" : "clicks"}
            </span>
            <span className="tabular-nums">{timeAgo(link.createdAt)}</span>
          </div>
          {link.banned && link.bannedReason && (
            <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">
              Reason: {link.bannedReason}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={`${link.shortUrl}+`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Preview ${link.displayUrl}`}
            title="Preview"
            className="border-border bg-secondary text-card-foreground hover:text-foreground hover:bg-secondary/70 focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-full border outline-none focus-visible:ring-3"
          >
            <Eye className="size-4" />
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${link.displayUrl}`}
              className="border-border bg-secondary text-card-foreground hover:text-foreground hover:bg-secondary/70 focus-visible:ring-ring/50 data-popup-open:bg-secondary/70 inline-flex size-9 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-3"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {link.banned ? (
                <DropdownMenuItem onClick={onUnban}>
                  <ShieldCheck />
                  Unban
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onBan}>
                  <Ban />
                  Ban link
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Panel>
  );
}

type Pending = { kind: "ban" | "delete"; link: AdminLink } | null;

export function LinksTab() {
  const [input, setInput] = useState("");
  const search = useDebounced(input.trim(), 300);
  const [filter, setFilter] = useState<AdminLinkFilter>("all");
  const [page, setPage] = usePage(`${search}|${filter}`);
  const [pending, setPending] = useState<Pending>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminLinks(
    search,
    filter,
    page,
  );
  const ban = useBanAdminLink();
  const remove = useDeleteAdminLink();

  async function setBanned(link: AdminLink, banned: boolean, reason?: string) {
    try {
      await ban.mutateAsync({ id: link.id, banned, reason });
      toast.success(banned ? `${link.displayUrl} was banned` : `${link.displayUrl} was unbanned`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function removeLink(link: AdminLink) {
    try {
      await remove.mutateAsync(link.id);
      toast.success(`${link.displayUrl} was deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={input}
          onChange={setInput}
          placeholder="Search by short code, URL or owner"
          label="Search links"
        />
        <Segmented value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      {isLoading ? (
        <RowsSkeleton tall />
      ) : isError || !data ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : data.links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title={search ? "No matching links" : "No links found"}
          description={search ? `Nothing matched "${search}".` : EMPTY_COPY[filter]}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {data.links.map((link) => (
              <li key={link.id}>
                <LinkRow
                  link={link}
                  onBan={() => setPending({ kind: "ban", link })}
                  onUnban={() => void setBanned(link, false)}
                  onDelete={() => setPending({ kind: "delete", link })}
                />
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            noun={data.total === 1 ? "link" : "links"}
            onPageChange={setPage}
            fetching={isFetching}
          />
        </>
      )}

      <BanLinkDialog
        open={pending?.kind === "ban"}
        onOpenChange={(open) => !open && setPending(null)}
        target={pending?.link.displayUrl ?? ""}
        onConfirm={(reason) => (pending ? setBanned(pending.link, true, reason) : undefined)}
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete this link?"
        description={
          pending
            ? `${pending.link.displayUrl} and its click history will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete link"
        onConfirm={() => (pending ? removeLink(pending.link) : undefined)}
      />
    </div>
  );
}
