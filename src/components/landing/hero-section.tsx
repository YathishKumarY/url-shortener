"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  Dices,
  Eye,
  Flame,
  Loader2,
  Lock,
  QrCode,
  SlidersHorizontal,
  Timer,
  Trash2,
} from "lucide-react";
import { QrDialog } from "@/components/dashboard/qr-dialog";
import { LinklyIcon } from "@/components/shared/linkly-icon";
import { Favicon, inputClass } from "@/components/shared/ui-kit";
import { Button } from "@/components/ui/button";
import { useInstanceConfig } from "@/hooks/use-settings";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn, copyToClipboard } from "@/lib/utils";
import type { LinkItem } from "@/types";

type RecentLink = Pick<
  LinkItem,
  | "id"
  | "shortCode"
  | "shortUrl"
  | "displayUrl"
  | "originalUrl"
  | "createdAt"
  | "hasPassword"
  | "maxClicks"
  | "expiresAt"
  | "domain"
> & { claimToken?: string };

const STORAGE_KEY = "linkly:recent-links";
const EXPIRY_OPTIONS = [
  { value: "", label: "Never expires" },
  { value: "3600", label: "Expires in 1 hour" },
  { value: "86400", label: "Expires in 1 day" },
  { value: "604800", label: "Expires in 7 days" },
  { value: "2592000", label: "Expires in 30 days" },
];
const LIMIT_OPTIONS = [
  { value: "", label: "Unlimited clicks" },
  { value: "1", label: "Self-destruct after 1 click" },
  { value: "10", label: "After 10 clicks" },
  { value: "100", label: "After 100 clicks" },
];

function loadRecent(): RecentLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentLink[]).slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveRecent(links: RecentLink[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links.slice(0, 20)));
  } catch {
    // private mode / storage full: the list simply is not persisted
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      aria-label={copied ? "Copied" : "Copy short link"}
      className="copy-btn-bg text-card-foreground hover:text-foreground relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[color,transform] duration-150 active:scale-[0.94]"
    >
      <Copy
        className="absolute size-4 transition-[opacity,transform] duration-200"
        style={{ opacity: copied ? 0 : 1, transform: copied ? "scale(0.3)" : "none" }}
      />
      <Check
        className="absolute size-4 text-green-500 transition-[opacity,transform] duration-200"
        style={{ opacity: copied ? 1 : 0, transform: copied ? "none" : "scale(0.3)" }}
      />
    </button>
  );
}

function RecentRow({
  link,
  onQr,
  onRemove,
}: {
  link: RecentLink;
  onQr: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="glass-row flex flex-col gap-3 px-5 py-4 text-left md:flex-row md:items-center md:gap-4">
      <div className="flex min-w-0 items-center gap-2.5 md:w-[280px] md:shrink-0">
        <a
          href={link.shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary truncate text-[15px] font-semibold hover:underline"
        >
          {link.displayUrl}
        </a>
        <CopyButton text={link.shortUrl} />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Favicon url={link.originalUrl} size={32} className="size-7" />
        <span className="text-card-foreground truncate text-sm font-light" title={link.originalUrl}>
          {link.originalUrl}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {link.hasPassword && (
          <span
            title="Password protected"
            className="bg-secondary text-muted-foreground flex size-7 items-center justify-center rounded-full"
          >
            <Lock className="size-3.5" />
          </span>
        )}
        {link.maxClicks !== null && (
          <span
            title={`Self-destructs after ${link.maxClicks} click${link.maxClicks === 1 ? "" : "s"}`}
            className="bg-secondary text-muted-foreground flex size-7 items-center justify-center rounded-full"
          >
            <Flame className="size-3.5" />
          </span>
        )}
        {link.expiresAt && (
          <span
            title={`Expires ${new Date(link.expiresAt).toLocaleString()}`}
            className="bg-secondary text-muted-foreground flex size-7 items-center justify-center rounded-full"
          >
            <Timer className="size-3.5" />
          </span>
        )}
        <span className="text-muted-foreground ml-1 hidden text-xs lg:inline">
          {formatDate(link.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onQr}
          aria-label="Show QR code"
          className="text-card-foreground hover:text-foreground hover:bg-secondary flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors"
        >
          <QrCode className="size-4" />
        </button>
        <a
          href={`${link.shortUrl}+`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open preview page"
          title="Preview page"
          className="text-card-foreground hover:text-foreground hover:bg-secondary flex size-9 items-center justify-center rounded-full transition-colors"
        >
          <Eye className="size-4" />
        </a>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove from this list"
          className="text-card-foreground hover:text-destructive hover:bg-secondary flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function HeroSection() {
  const { data: config } = useInstanceConfig();
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState<RecentLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [alias, setAlias] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState("");
  const [limit, setLimit] = useState("");
  const [qrFor, setQrFor] = useState<RecentLink | null>(null);
  const anonymousDisabled = config ? !config.anonymousLinksEnabled : false;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinks(loadRecent());
  }, []);

  function update(next: RecentLink[]) {
    setLinks(next);
    saveRecent(next);
  }

  async function handleShorten(e: React.FormEvent) {
    e.preventDefault();
    let value = url.trim();
    if (!value) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;

    setLoading(true);
    setError("");
    try {
      const link = await apiFetch<LinkItem & { claimToken?: string }>("/api/links", {
        method: "POST",
        json: {
          url: value,
          ...(alias.trim() ? { customAlias: alias.trim() } : emoji ? { emoji: true } : {}),
          ...(password ? { password } : {}),
          ...(expiry
            ? { expiresAt: new Date(Date.now() + Number(expiry) * 1000).toISOString() }
            : {}),
          ...(limit ? { maxClicks: Number(limit) } : {}),
        },
      });
      const recent: RecentLink = {
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: link.shortUrl,
        displayUrl: link.displayUrl,
        originalUrl: link.originalUrl,
        createdAt: link.createdAt,
        hasPassword: link.hasPassword,
        maxClicks: link.maxClicks,
        expiresAt: link.expiresAt,
        domain: link.domain,
        claimToken: link.claimToken,
      };
      update([recent, ...links.filter((l) => l.id !== link.id)]);
      await copyToClipboard(link.shortUrl);
      setUrl("");
      setAlias("");
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative z-10 flex flex-col items-center px-4 pt-8 pb-16 text-center sm:px-6 md:px-12 md:pt-14">
      <span className="border-border bg-secondary/70 text-card-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur">
        <span className="bg-primary size-1.5 rounded-full" />
        Open source · Self-hostable · Free forever
      </span>
      <h1 className="max-w-4xl text-[35px] leading-[1.15] font-extrabold tracking-tight sm:text-5xl md:text-[64px] md:leading-[1.1]">
        <span className="gradient-title">Shorten Your Loooong Links :)</span>
      </h1>
      <p className="text-card-foreground mt-5 max-w-xl text-base leading-relaxed font-light md:text-lg">
        Short links with superpowers: passwords, self-destruct, smart targeting, A/B tests, QR codes
        and real-time analytics. No account needed to start.
      </p>

      {anonymousDisabled ? (
        <div className="border-border bg-secondary/70 mt-10 w-full max-w-[660px] rounded-3xl border p-6 backdrop-blur">
          <p className="text-foreground font-semibold">
            This instance requires an account to create links.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/auth/signin"
              className="border-border bg-secondary text-card-foreground rounded-full border px-5 py-2.5 text-sm font-semibold"
            >
              Sign in
            </Link>
            {config?.registrationEnabled && (
              <Link
                href="/auth/signup"
                className="bg-primary shadow-blue rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                Create account
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleShorten} className="mt-10 w-full max-w-[680px]">
          <div className="shadow-soft search-pill relative flex h-[64px] items-center rounded-[48px] sm:h-[76px]">
            <div className="flex flex-1 items-center gap-3 pl-5 sm:gap-4 sm:pl-6">
              <LinklyIcon className="h-5 w-5 shrink-0" />
              <input
                type="text"
                inputMode="url"
                aria-label="Long URL"
                placeholder="Enter the link here"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="text-card-foreground placeholder:text-card-foreground/80 h-full min-w-0 flex-1 bg-transparent text-base font-light outline-none"
              />
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                aria-expanded={showOptions}
                aria-label="Link options"
                title="Link options"
                className={cn(
                  "text-card-foreground hover:text-foreground flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
                  showOptions && "bg-primary/15 text-primary",
                )}
              >
                <SlidersHorizontal className="size-4" />
              </button>
            </div>
            <div className="pr-1.5 sm:pr-2">
              <Button
                type="submit"
                disabled={loading}
                aria-label="Shorten"
                className="bg-primary shadow-blue hover:bg-primary/90 h-[50px] rounded-[40px] px-4 text-sm font-semibold text-white sm:h-[60px] sm:px-8"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span className="hidden sm:inline">Shorten Now!</span>
                    <ArrowRight className="size-4 sm:hidden" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {showOptions && (
            <div className="border-border bg-secondary/80 animate-in fade-in slide-in-from-top-2 mt-3 grid gap-3 rounded-3xl border p-4 text-left backdrop-blur-xl duration-200 sm:grid-cols-2">
              <label className="block">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">
                  Custom alias
                </span>
                <input
                  value={alias}
                  onChange={(e) => {
                    setAlias(e.target.value.replace(/\s+/g, "-"));
                    setEmoji(false);
                  }}
                  placeholder="my-link"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">Expiry</span>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className={inputClass}
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">
                  Click limit
                </span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className={inputClass}
                >
                  {LIMIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setEmoji((v) => !v);
                  setAlias("");
                }}
                className={cn(
                  "inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors sm:col-span-2",
                  emoji
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-border text-card-foreground hover:text-foreground",
                )}
              >
                <Dices className="size-3.5" /> Emoji short code {emoji ? "on 🦊🍕🚀" : "off"}
              </button>
            </div>
          )}
          {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
        </form>
      )}

      <p className="text-card-foreground mt-6 text-sm font-light">
        Links are copied to your clipboard automatically.{" "}
        {config?.registrationEnabled !== false && (
          <>
            <Link
              href="/auth/signup"
              className="text-foreground font-bold underline decoration-solid underline-offset-2"
            >
              Register free
            </Link>{" "}
            for analytics, editing, custom domains and more.
          </>
        )}
      </p>

      {links.length > 0 && (
        <div className="mt-10 w-full max-w-6xl">
          <div className="flex flex-col gap-[3px] overflow-hidden rounded-2xl">
            <div className="glass-header flex items-center justify-between px-5 py-4">
              <span className="text-card-foreground text-[15px] font-bold">Your recent links</span>
              <span className="text-muted-foreground text-xs">Saved in this browser only</span>
            </div>
            {links.map((link) => (
              <RecentRow
                key={link.id}
                link={link}
                onQr={() => setQrFor(link)}
                onRemove={() => update(links.filter((l) => l.id !== link.id))}
              />
            ))}
          </div>
        </div>
      )}

      {qrFor && (
        <QrDialog
          open={!!qrFor}
          onOpenChange={(open) => !open && setQrFor(null)}
          shortCode={qrFor.shortCode}
          domain={qrFor.domain}
          displayUrl={qrFor.displayUrl}
        />
      )}
    </section>
  );
}
