"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Plus,
  Search,
  SearchX,
  Tag,
  X,
} from "lucide-react";
import { BulkBar } from "@/components/dashboard/bulk-bar";
import { BulkCreateDialog } from "@/components/dashboard/bulk-create-dialog";
import { ClaimBanner } from "@/components/dashboard/claim-banner";
import { LinkRow, SelectBox } from "@/components/dashboard/link-row";
import { EmptyState, Kbd, PageHeader, pill, Segmented } from "@/components/shared/ui-kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLinks } from "@/hooks/use-links";
import { useTags } from "@/hooks/use-settings";
import { downloadFrom } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "disabled", label: "Paused" },
  { value: "protected", label: "Protected" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "clicks:desc", label: "Most clicks" },
  { value: "lastClickedAt:desc", label: "Recently clicked" },
  { value: "title:asc", label: "Title A-Z" },
];

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function LinksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const status = params.get("status") ?? "all";
  const tag = params.get("tag") ?? "";
  const sortKey = params.get("sort") ?? "createdAt:desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebounced(search);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function setParams(updates: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || (key === "status" && value === "all")) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // Keep the search box and the URL in sync without a request per keystroke.
  useEffect(() => {
    if ((params.get("q") ?? "") !== debouncedSearch) setParams({ q: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // "/" focuses search, like GitHub and Dub.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [sort, order] = sortKey.split(":") as [string, "asc" | "desc"];
  const { data, isLoading, isFetching } = useLinks({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch,
    status,
    tag,
    sort,
    order,
  });
  const { data: tags } = useTags();
  const activeTag = tags?.find((t) => t.id === tag);
  const links = useMemo(() => data?.links ?? [], [data]);
  const allSelected = links.length > 0 && links.every((l) => selected.has(l.id));
  const hasFilters = status !== "all" || !!tag || !!debouncedSearch;

  // Selection only makes sense for what is on screen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((prev) => new Set([...prev].filter((id) => links.some((l) => l.id === id))));
  }, [links]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl pb-28">
      <PageHeader
        title={
          <span className="flex items-baseline gap-2">
            Links
            {data && (
              <span className="text-muted-foreground text-base font-medium tabular-nums">
                {formatNumber(data.total)}
              </span>
            )}
          </span>
        }
        description="Every short link you own. Click a link for analytics, or use the menu for quick actions."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger className={pill.secondary} aria-label="Export links">
                <Download /> <span className="hidden sm:inline">Export</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => downloadFrom("/api/links/export?format=csv")}
                >
                  CSV (spreadsheets)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => downloadFrom("/api/links/export?format=json")}
                >
                  JSON (full detail)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <BulkCreateDialog />
            <Link href="/dashboard/links/new" className={pill.primary}>
              <Plus /> New link
            </Link>
          </>
        }
      />

      <ClaimBanner />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by short code, destination, title or notes"
              aria-label="Search links"
              className="border-border bg-secondary text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/25 h-10 w-full rounded-full border pr-16 pl-10 text-sm outline-none focus-visible:ring-3"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            ) : (
              <span className="absolute top-1/2 right-3 hidden -translate-y-1/2 sm:block">
                <Kbd>/</Kbd>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(pill.secondary, "h-10")}>
                <Tag />
                {activeTag ? (
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", TAG_DOT_CLASSES[activeTag.color])} />
                    {activeTag.name}
                  </span>
                ) : (
                  "Tags"
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Filter by tag
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setParams({ tag: null })}
                >
                  All tags
                </DropdownMenuItem>
                {tags && tags.length > 0 && <DropdownMenuSeparator />}
                {tags?.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    className="cursor-pointer gap-2"
                    onClick={() => setParams({ tag: t.id })}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        TAG_DOT_CLASSES[t.color] ?? "bg-zinc-500",
                      )}
                    />
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {t.linkCount}
                    </span>
                  </DropdownMenuItem>
                ))}
                {tags?.length === 0 && (
                  <p className="text-muted-foreground px-2 py-1.5 text-xs">
                    Add tags when creating or editing links.
                  </p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(pill.secondary, "h-10")}>
                <ArrowDownUp />
                <span className="hidden sm:inline">
                  {SORT_OPTIONS.find((s) => s.value === sortKey)?.label ?? "Sort"}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    className={cn(
                      "cursor-pointer",
                      option.value === sortKey && "text-primary font-medium",
                    )}
                    onClick={() =>
                      setParams({ sort: option.value === "createdAt:desc" ? null : option.value })
                    }
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Segmented
          value={status}
          onChange={(value) => setParams({ status: value })}
          options={STATUS_OPTIONS}
        />
      </div>

      <div className="border-border/60 bg-card/70 shadow-soft overflow-hidden rounded-2xl border backdrop-blur-sm">
        <div className="glass-header border-border/60 flex items-center gap-3 rounded-none border-b px-4 py-3 sm:gap-4 sm:px-5">
          <SelectBox
            checked={allSelected}
            label="Select all links on this page"
            onChange={() => setSelected(allSelected ? new Set() : new Set(links.map((l) => l.id)))}
          />
          <span className="text-card-foreground flex-1 text-[13px] font-semibold">
            {isFetching && !isLoading ? "Updating..." : "Link"}
          </span>
          <span className="text-card-foreground hidden w-28 text-center text-[13px] font-semibold lg:block">
            Status
          </span>
          <span className="text-card-foreground w-20 text-center text-[13px] font-semibold">
            Clicks
          </span>
          <span className="text-card-foreground hidden w-24 text-center text-[13px] font-semibold xl:block">
            Created
          </span>
          <span className="w-9" />
        </div>

        {isLoading ? (
          <div className="divide-border/50 divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="p-6">
            {hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="No links match these filters"
                description="Try a different search, status or tag."
                action={
                  <button
                    type="button"
                    className={pill.secondary}
                    onClick={() => {
                      setSearch("");
                      setParams({ status: null, tag: null, q: null });
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={Link2}
                title="Create your first short link"
                description="Paste a URL in the bar above for an instant link, or open the builder for passwords, expiry, targeting, QR codes and more."
                action={
                  <Link href="/dashboard/links/new" className={pill.primary}>
                    <Plus /> New link
                  </Link>
                }
              />
            )}
          </div>
        ) : (
          <div className="divide-border/50 divide-y">
            {links.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                selected={selected.has(link.id)}
                onToggleSelect={() => toggle(link.id)}
              />
            ))}
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm tabular-nums">
            {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, data.total)} of{" "}
            {formatNumber(data.total)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) }, false)}
            >
              <ChevronLeft /> Previous
            </button>
            <span className="text-card-foreground text-sm tabular-nums">
              {page} / {data.totalPages}
            </span>
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              disabled={page >= data.totalPages}
              onClick={() => setParams({ page: String(page + 1) }, false)}
            >
              Next <ChevronRight />
            </button>
          </div>
        </div>
      )}

      <BulkBar selected={[...selected]} onClear={() => setSelected(new Set())} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <LinksPage />
    </Suspense>
  );
}
