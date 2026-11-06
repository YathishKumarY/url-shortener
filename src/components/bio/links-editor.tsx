"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Info,
  Link2,
  MousePointerClick,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { flushSync } from "react-dom";
import { bioLinkTitle, FEATURED_MAX } from "@/components/bio/utils";
import { EmptyState, Favicon, inputClass, pill } from "@/components/shared/ui-kit";
import { Switch } from "@/components/ui/switch";
import type { BioLinkItem } from "@/hooks/use-bio";
import { compactNumber, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEARCH_THRESHOLD = 6;

interface LinksEditorProps {
  /** Every link the owner can feature (from GET /api/bio). */
  links: BioLinkItem[];
  /** Ordered ids of the featured links. */
  featured: string[];
  onChange: (featured: string[]) => void;
}

function LinkSummary({ link }: { link: BioLinkItem }) {
  return (
    <>
      <Favicon url={link.originalUrl} className="size-9 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">{bioLinkTitle(link)}</p>
        <p className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
          <span className="truncate font-mono text-[11px]">
            {link.domain ? `${link.domain}/` : "/"}
            {link.shortCode}
          </span>
          <span aria-hidden className="text-muted-foreground/60">
            ·
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-1 tabular-nums"
            title={`${formatNumber(link.clickCount)} clicks`}
          >
            <MousePointerClick aria-hidden className="size-3" />
            {compactNumber(link.clickCount)}
            <span className="sr-only"> clicks</span>
          </span>
        </p>
      </div>
    </>
  );
}

const moveButton =
  "text-muted-foreground hover:text-foreground hover:bg-secondary inline-flex size-9 cursor-pointer items-center justify-center rounded-full outline-none transition-[background-color,color,scale] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] aria-disabled:pointer-events-none aria-disabled:opacity-35 [&_svg]:size-4";

/**
 * Pick and order the links shown on the bio page.
 *
 * Rows move between the two lists as they are switched on and off, so focus
 * is placed explicitly afterwards (the switch a keyboard user pressed no
 * longer exists) and every change is announced to screen readers.
 */
export function LinksEditor({ links, featured, onChange }: LinksEditorProps) {
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const switches = useRef(new Map<string, HTMLElement>());

  const byId = useMemo(() => new Map(links.map((link) => [link.id, link])), [links]);
  const featuredLinks = useMemo(
    () => featured.flatMap((id) => byId.get(id) ?? []),
    [featured, byId],
  );
  const featuredIds = featuredLinks.map((link) => link.id);
  const available = useMemo(() => {
    const chosen = new Set(featured);
    return links.filter((link) => !chosen.has(link.id));
  }, [links, featured]);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? available.filter((link) =>
        [link.title ?? "", link.originalUrl, link.shortCode, link.domain].some((value) =>
          value.toLowerCase().includes(needle),
        ),
      )
    : available;
  const atLimit = featuredIds.length >= FEATURED_MAX;

  function registerSwitch(id: string) {
    return (element: HTMLElement | null) => {
      if (!element) return;
      switches.current.set(id, element);
      return () => {
        if (switches.current.get(id) === element) switches.current.delete(id);
      };
    };
  }

  function focusSwitch(id: string | undefined) {
    if (id) switches.current.get(id)?.focus();
  }

  function feature(link: BioLinkItem) {
    if (atLimit) return;
    const index = visible.findIndex((item) => item.id === link.id);
    const neighbour = visible[index + 1] ?? visible[index - 1];
    flushSync(() => {
      onChange([...featuredIds, link.id]);
      setRecentlyAdded(link.id);
    });
    // Stay in the list being worked through; fall back to the new row.
    focusSwitch(neighbour?.id ?? link.id);
    setAnnouncement(`Added ${bioLinkTitle(link)} to your page, position ${featuredIds.length + 1}`);
  }

  function unfeature(link: BioLinkItem) {
    const index = featuredIds.indexOf(link.id);
    const neighbour = featuredIds[index + 1] ?? featuredIds[index - 1];
    flushSync(() => onChange(featuredIds.filter((id) => id !== link.id)));
    focusSwitch(neighbour ?? link.id);
    setAnnouncement(`Removed ${bioLinkTitle(link)} from your page`);
  }

  function move(link: BioLinkItem, delta: -1 | 1) {
    const from = featuredIds.indexOf(link.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= featuredIds.length) return;
    const next = [...featuredIds];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
    setAnnouncement(`Moved ${bioLinkTitle(link)} to position ${to + 1} of ${next.length}`);
  }

  if (links.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No links to feature yet"
        description="Shorten a link and it shows up here, ready to put on your page."
        action={
          <Link href="/dashboard/links/new" className={pill.primary}>
            <Plus /> New link
          </Link>
        }
        className="py-10"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Featured, in page order */}
      <section aria-labelledby="bio-featured-heading">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h3 id="bio-featured-heading" className="text-card-foreground text-[13px] font-semibold">
            On your page
          </h3>
          <span className="text-muted-foreground text-xs tabular-nums">
            {featuredIds.length} of {FEATURED_MAX}
          </span>
        </div>

        {featuredLinks.length === 0 ? (
          <div className="border-border/80 text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm text-pretty">
            Nothing here yet. Switch on a link below to add it to your page.
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {featuredLinks.map((link, index) => {
              const title = bioLinkTitle(link);
              const first = index === 0;
              const last = index === featuredLinks.length - 1;
              return (
                <li
                  key={link.id}
                  className={cn(
                    "bg-secondary/50 flex items-center gap-2.5 rounded-xl py-2 pr-2 pl-2.5 shadow-[0_0_0_1px_var(--border)] sm:gap-3",
                    link.id === recentlyAdded &&
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:animation-duration-300",
                  )}
                >
                  <span
                    aria-hidden
                    className="text-muted-foreground hidden w-4 shrink-0 text-center text-xs font-semibold tabular-nums sm:block"
                  >
                    {index + 1}
                  </span>
                  <LinkSummary link={link} />
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Move ${title} up`}
                      aria-disabled={first || undefined}
                      onClick={() => move(link, -1)}
                      className={moveButton}
                    >
                      <ArrowUp />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${title} down`}
                      aria-disabled={last || undefined}
                      onClick={() => move(link, 1)}
                      className={moveButton}
                    >
                      <ArrowDown />
                    </button>
                  </div>
                  <Switch
                    ref={registerSwitch(link.id)}
                    checked
                    onCheckedChange={() => unfeature(link)}
                    aria-label={`Show ${title} on your page`}
                    className="mx-1"
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Everything else */}
      <section aria-labelledby="bio-available-heading">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h3 id="bio-available-heading" className="text-card-foreground text-[13px] font-semibold">
            Your links
          </h3>
          {atLimit && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Limit reached</span>
          )}
        </div>

        {available.length > SEARCH_THRESHOLD && (
          <div className="relative mb-2">
            <Search
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Inside the editor form: Enter must not submit it.
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Search by title, URL or code"
              aria-label="Search your links"
              className={cn(inputClass, "h-9 pl-9")}
            />
          </div>
        )}

        {available.length === 0 ? (
          <p className="text-muted-foreground rounded-xl px-4 py-5 text-center text-sm">
            Every link is on your page.
          </p>
        ) : visible.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-6 text-center text-sm">
            <SearchX aria-hidden className="size-5" />
            No links match &ldquo;{query.trim()}&rdquo;
          </div>
        ) : (
          <ul className="scrollbar-none -mx-1.5 flex max-h-[25rem] flex-col gap-0.5 overflow-y-auto px-1.5 py-1">
            {visible.map((link) => {
              const labelId = `bio-feature-${link.id}`;
              return (
                <li key={link.id}>
                  {/* The whole row is the hit area; the switch keeps a concise name. */}
                  <label
                    className={cn(
                      "hover:bg-secondary/60 flex cursor-pointer items-center gap-2.5 rounded-xl py-2 pr-2 pl-2.5 transition-colors sm:gap-3",
                      atLimit && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <LinkSummary link={link} />
                    <span id={labelId} className="sr-only">
                      Show {bioLinkTitle(link)} on your page
                    </span>
                    <Switch
                      ref={registerSwitch(link.id)}
                      checked={false}
                      disabled={atLimit}
                      onCheckedChange={() => feature(link)}
                      aria-labelledby={labelId}
                      className="mx-1"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground flex items-start gap-2 px-1 text-xs leading-relaxed">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Visitors only see links that are live: paused, expired and scheduled links are hidden until
        they resolve again.
      </p>
    </div>
  );
}
