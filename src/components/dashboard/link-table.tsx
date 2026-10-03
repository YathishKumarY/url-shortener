"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, Trash2, Pencil, Link2 } from "lucide-react";
import { toast } from "sonner";
import { QrCodeDisplay } from "@/components/shared/qr-code-display";
import { Skeleton } from "@/components/ui/skeleton";
import { useLinks, useDeleteLink } from "@/hooks/use-links";
import { copyToClipboard, faviconUrl } from "@/lib/utils";
import type { LinkWithClicks } from "@/types";

function CopyCell({ shortCode }: { shortCode: string }) {
  const [copied, setCopied] = useState(false);
  const shortUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${shortCode}`;

  async function handleCopy() {
    await copyToClipboard(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-card-foreground max-w-[220px] truncate text-sm font-light">
        {shortUrl}
      </span>
      <button
        onClick={handleCopy}
        aria-label={copied ? "Short link copied" : `Copy short link for ${shortCode}`}
        title="Copy short link"
        className="copy-btn-bg text-card-foreground hover:text-foreground flex shrink-0 cursor-pointer items-center justify-center rounded-full p-2.5 transition-colors"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function StatusCell({ link }: { link: LinkWithClicks }) {
  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
  const isActive = !isExpired;

  return (
    <span className={`text-sm font-light ${isActive ? "text-[#1eb036]" : "text-[#b0901e]"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function BulkCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
        checked
          ? "bg-primary border-primary text-white"
          : "border-border hover:border-card-foreground bg-transparent text-transparent"
      }`}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
}

function MobileCard({
  link,
  onDelete,
  deleting,
  bulkMode,
  selected,
  onToggleSelect,
}: {
  link: LinkWithClicks;
  onDelete: (id: string) => void;
  deleting: boolean;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  return (
    <div className="glass-row space-y-3 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {bulkMode && onToggleSelect && (
            <BulkCheckbox checked={!!selected} onChange={onToggleSelect} />
          )}
          <CopyCell shortCode={link.shortCode} />
        </div>
        <StatusCell link={link} />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {faviconUrl(link.originalUrl, 16) && (
          <img
            src={faviconUrl(link.originalUrl, 16)!}
            alt=""
            className="h-4 w-4 shrink-0 rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <a
          href={link.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-card-foreground hover:text-foreground truncate text-sm font-light"
        >
          {link.originalUrl}
        </a>
      </div>

      <div className="text-card-foreground flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span>{link.clickCount} clicks</span>
          <span>
            {new Date(link.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        {!bulkMode && (
          <div className="flex items-center gap-2">
            <QrCodeDisplay shortCode={link.shortCode} />
            <Link
              href={`/dashboard/links/${link.id}`}
              aria-label={`Edit link ${link.shortCode}`}
              title="Edit link"
              className="border-border bg-secondary shadow-soft text-foreground hover:bg-secondary/80 flex items-center justify-center rounded-full border p-2 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => onDelete(link.id)}
              disabled={deleting}
              aria-label={`Delete link ${link.shortCode}`}
              title="Delete link"
              className="border-border bg-secondary shadow-soft text-foreground hover:bg-secondary/80 flex items-center justify-center rounded-full border p-2 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LinkTable({
  page,
  search,
  statusFilter = "all",
  bulkMode = false,
  selected,
  onToggleSelect,
}: {
  page: number;
  search: string;
  statusFilter?: "all" | "active" | "inactive";
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const { data, isLoading } = useLinks(page, search);
  const deleteLink = useDeleteLink();

  async function handleDelete(id: string) {
    try {
      await deleteLink.mutateAsync(id);
      toast.success("Link deleted");
    } catch {
      toast.error("Failed to delete link");
    }
  }

  const filteredLinks = data?.links.filter((link) => {
    if (statusFilter === "all") return true;
    const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
    return statusFilter === "active" ? !isExpired : isExpired;
  });

  if (isLoading) {
    return (
      <div className="space-y-1">
        <div className="glass-header h-16 rounded-t-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="glass-row h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!filteredLinks?.length) {
    return (
      <div className="text-card-foreground flex flex-col items-center justify-center py-16">
        <Link2 className="mb-4 h-12 w-12 opacity-40" />
        <p className="text-lg font-medium">No links yet</p>
        <p className="text-sm font-light opacity-70">
          Use the input above to shorten your first URL
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="space-y-1 md:hidden">
        {filteredLinks.map((link) => (
          <MobileCard
            key={link.id}
            link={link}
            onDelete={handleDelete}
            deleting={deleteLink.isPending}
            bulkMode={bulkMode}
            selected={selected?.has(link.id)}
            onToggleSelect={onToggleSelect ? () => onToggleSelect(link.id) : undefined}
          />
        ))}
      </div>

      {/* Desktop: Figma-style glassmorphic table */}
      <div className="table-wrap-bg hidden gap-[3px] overflow-hidden rounded-lg md:flex md:flex-col">
        {/* Header */}
        <div className="glass-header flex items-center px-6 py-5">
          {bulkMode && <span className="w-[36px] shrink-0" />}
          <span className="text-card-foreground w-[280px] text-[15px] font-bold">Short Link</span>
          <span className="text-card-foreground min-w-[200px] flex-1 text-[15px] font-bold">
            Original Link
          </span>
          <span className="text-card-foreground w-[80px] text-center text-[15px] font-bold">
            QR Code
          </span>
          <span className="text-card-foreground w-[70px] text-center text-[15px] font-bold">
            Clicks
          </span>
          <span className="text-card-foreground w-[120px] text-center text-[15px] font-bold">
            Status
          </span>
          <span className="text-card-foreground w-[130px] text-center text-[15px] font-bold">
            Date
          </span>
          {!bulkMode && (
            <span className="text-card-foreground w-[110px] text-center text-[15px] font-bold">
              Action
            </span>
          )}
        </div>

        {/* Rows */}
        {filteredLinks.map((link, idx) => (
          <div
            key={link.id}
            className={`${idx >= filteredLinks.length - 1 ? "glass-row-dim" : "glass-row"} flex items-center px-6 py-4 ${
              selected?.has(link.id) ? "ring-primary/50 ring-1" : ""
            }`}
          >
            {bulkMode && onToggleSelect && (
              <div className="w-[36px] shrink-0">
                <BulkCheckbox
                  checked={!!selected?.has(link.id)}
                  onChange={() => onToggleSelect(link.id)}
                />
              </div>
            )}

            {/* Short Link */}
            <div className="w-[280px]">
              <CopyCell shortCode={link.shortCode} />
            </div>

            {/* Original Link with favicon */}
            <div className="flex min-w-[200px] flex-1 items-center gap-2.5 pr-4">
              {faviconUrl(link.originalUrl, 32) && (
                <img
                  src={faviconUrl(link.originalUrl, 32)!}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <a
                href={link.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-card-foreground hover:text-foreground truncate text-sm font-light"
              >
                {link.originalUrl}
              </a>
            </div>

            {/* QR Code */}
            <div className="flex w-[80px] justify-center">
              <QrCodeDisplay shortCode={link.shortCode} />
            </div>

            {/* Clicks */}
            <div className="w-[70px] text-center">
              <span className="text-card-foreground text-sm font-light">{link.clickCount}</span>
            </div>

            {/* Status */}
            <div className="flex w-[120px] justify-center">
              <StatusCell link={link} />
            </div>

            {/* Date */}
            <div className="w-[130px] text-center">
              <span className="text-card-foreground text-sm font-light">
                {new Date(link.createdAt)
                  .toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  })
                  .replace(",", " -")
                  .replace(" ", " - ")}
              </span>
            </div>

            {/* Action buttons */}
            {!bulkMode && (
              <div className="flex w-[110px] items-center justify-center gap-2.5">
                <Link
                  href={`/dashboard/links/${link.id}`}
                  aria-label={`Edit link ${link.shortCode}`}
                  title="Edit link"
                  className="border-border bg-secondary shadow-soft text-foreground hover:bg-secondary/80 flex size-[42px] items-center justify-center rounded-full border transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => handleDelete(link.id)}
                  disabled={deleteLink.isPending}
                  aria-label={`Delete link ${link.shortCode}`}
                  title="Delete link"
                  className="border-border bg-secondary shadow-soft text-foreground hover:bg-secondary/80 flex size-[42px] items-center justify-center rounded-full border transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
