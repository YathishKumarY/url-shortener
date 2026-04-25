"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, MousePointerClick, Users, Loader2, Save, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { ClicksChart } from "@/components/analytics/clicks-chart";
import { DevicesChart } from "@/components/analytics/devices-chart";
import { LocationsTable } from "@/components/analytics/locations-table";
import { ReferrersChart } from "@/components/analytics/referrers-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/use-analytics";
import { useLink, useUpdateLink } from "@/hooks/use-links";
import { cn, copyToClipboard } from "@/lib/utils";

const periods = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" },
];

const ALIAS_REGEX = /^[a-zA-Z0-9_-]+$/;

interface FieldErrors {
  originalUrl?: string;
  customAlias?: string;
  expiresAt?: string;
}

function CopyShortUrl({ shortCode }: { shortCode: string }) {
  const [copied, setCopied] = useState(false);
  const shortUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${shortCode}`;

  async function handleCopy() {
    await copyToClipboard(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-card-foreground truncate text-sm font-light">{shortUrl}</span>
      <button
        onClick={handleCopy}
        className="copy-btn-bg text-card-foreground hover:text-foreground flex shrink-0 items-center justify-center rounded-full p-2 transition-colors"
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

export default function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: link, isLoading: linkLoading, error: linkError } = useLink(id);
  const updateLink = useUpdateLink();
  const [period, setPeriod] = useState("7d");
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(id, period);

  const [originalUrl, setOriginalUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (link) {
      setOriginalUrl(link.originalUrl);
      setCustomAlias(link.customAlias ?? "");
      setExpiresAt(link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "");
    }
  }, [link]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function validate(): boolean {
    const errors: FieldErrors = {};
    const trimmedUrl = originalUrl.trim();
    const trimmedAlias = customAlias.trim();

    if (!trimmedUrl) {
      errors.originalUrl = "URL is required";
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.originalUrl = "Only http and https URLs are allowed";
        }
      } catch {
        errors.originalUrl = "Please enter a valid URL (e.g. https://example.com)";
      }
      if (trimmedUrl.length > 2048) {
        errors.originalUrl = "URL must be under 2048 characters";
      }
    }

    if (trimmedAlias) {
      if (!ALIAS_REGEX.test(trimmedAlias)) {
        errors.customAlias = "Only letters, numbers, hyphens, and underscores allowed";
      } else if (trimmedAlias.length < 3) {
        errors.customAlias = "Alias must be at least 3 characters";
      } else if (trimmedAlias.length > 30) {
        errors.customAlias = "Alias must be under 30 characters";
      }
    }

    if (expiresAt) {
      const expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        errors.expiresAt = "Invalid date";
      } else if (expiryDate <= new Date()) {
        errors.expiresAt = "Expiration date must be in the future";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) {
      setFieldErrors((p) => ({ ...p, [field]: undefined }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    try {
      await updateLink.mutateAsync({
        id,
        originalUrl: originalUrl.trim(),
        customAlias: customAlias.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      toast.success("Link updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  function handleClearExpiry() {
    setExpiresAt("");
    clearFieldError("expiresAt");
  }

  const isExpired = link?.expiresAt && new Date(link.expiresAt) < new Date();

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-card-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-card-foreground text-xl font-bold">Edit Link</h1>
      </div>

      {linkLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      ) : linkError ? (
        <div className="text-card-foreground flex flex-col items-center justify-center py-16">
          <p className="mb-2 text-lg font-medium">Failed to load link</p>
          <p className="text-sm font-light opacity-70">
            {linkError instanceof Error
              ? linkError.message
              : "Something went wrong. Please try again."}
          </p>
          <Link
            href="/dashboard"
            className="bg-primary hover:bg-primary/90 mt-6 rounded-[48px] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      ) : link ? (
        <>
          {/* Edit form */}
          <div className="glass-row mb-8 rounded-lg p-6">
            <div className="mb-6 flex items-center justify-between">
              <CopyShortUrl shortCode={link.shortCode} />
              <span
                className={`rounded-full px-3 py-1 text-sm font-light ${
                  isExpired
                    ? "bg-[rgba(176,144,30,0.19)] text-[#b0901e]"
                    : "bg-[rgba(30,176,54,0.14)] text-[#1eb036]"
                }`}
              >
                {isExpired ? "Inactive" : "Active"}
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="text-card-foreground mb-1.5 block text-sm font-light">
                  Destination URL
                </label>
                <Input
                  type="url"
                  value={originalUrl}
                  onChange={(e) => {
                    setOriginalUrl(e.target.value);
                    clearFieldError("originalUrl");
                  }}
                  className={`border-border bg-secondary text-card-foreground placeholder:text-card-foreground/50 h-11 rounded-[48px] ${fieldErrors.originalUrl ? "border-destructive" : ""}`}
                />
                {fieldErrors.originalUrl && (
                  <p className="text-destructive mt-1 text-xs">{fieldErrors.originalUrl}</p>
                )}
              </div>

              <div>
                <label className="text-card-foreground mb-1.5 block text-sm font-light">
                  Custom Alias
                </label>
                <Input
                  placeholder={link.shortCode}
                  value={customAlias}
                  onChange={(e) => {
                    setCustomAlias(e.target.value);
                    clearFieldError("customAlias");
                  }}
                  className={`border-border bg-secondary text-card-foreground placeholder:text-card-foreground/50 h-11 rounded-[48px] ${fieldErrors.customAlias ? "border-destructive" : ""}`}
                />
                {fieldErrors.customAlias ? (
                  <p className="text-destructive mt-1 text-xs">{fieldErrors.customAlias}</p>
                ) : (
                  <p className="text-card-foreground/50 mt-1 text-xs font-light">
                    Leave blank to keep current short code: {link.shortCode}
                  </p>
                )}
              </div>

              <div>
                <label className="text-card-foreground mb-1.5 block text-sm font-light">
                  Expiration Date
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => {
                      setExpiresAt(e.target.value);
                      clearFieldError("expiresAt");
                    }}
                    min={new Date().toISOString().slice(0, 16)}
                    className={`border-border bg-secondary text-card-foreground h-11 flex-1 rounded-[48px] ${fieldErrors.expiresAt ? "border-destructive" : ""}`}
                  />
                  {expiresAt && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClearExpiry}
                      className="border-border bg-secondary text-card-foreground hover:bg-secondary/80 h-11 rounded-[48px]"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {fieldErrors.expiresAt ? (
                  <p className="text-destructive mt-1 text-xs">{fieldErrors.expiresAt}</p>
                ) : (
                  <p className="text-card-foreground/50 mt-1 text-xs font-light">
                    {expiresAt
                      ? `Expires: ${new Date(expiresAt).toLocaleString()}`
                      : "No expiration (link stays active forever)"}
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={updateLink.isPending}
                  className="bg-primary shadow-blue hover:bg-primary/90 h-11 rounded-[48px] px-8 text-sm font-semibold text-white"
                >
                  {updateLink.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>

          {/* Analytics section */}
          <div className="mb-6">
            <h2 className="text-card-foreground mb-4 text-lg font-bold">Analytics</h2>
            <div className="mb-6 flex items-center gap-2">
              {periods.map((p) => (
                <Button
                  key={p.value}
                  variant={period === p.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p.value)}
                  className={cn(
                    "rounded-[48px]",
                    period !== p.value &&
                      "border-border bg-secondary text-card-foreground hover:bg-secondary/80",
                  )}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {analyticsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[300px] rounded-lg" />
                ))}
              </div>
            ) : analytics ? (
              <>
                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <div className="glass-row flex items-center gap-4 rounded-lg p-6">
                    <div className="bg-primary/10 rounded-full p-3">
                      <MousePointerClick className="text-primary h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-card-foreground/70 text-sm font-light">Total Clicks</p>
                      <p className="text-card-foreground text-2xl font-bold">
                        {analytics.totalClicks}
                      </p>
                    </div>
                  </div>
                  <div className="glass-row flex items-center gap-4 rounded-lg p-6">
                    <div className="rounded-full bg-green-500/10 p-3">
                      <Users className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-card-foreground/70 text-sm font-light">Unique Visitors</p>
                      <p className="text-card-foreground text-2xl font-bold">
                        {analytics.uniqueVisitors}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ClicksChart data={analytics.clicksOverTime} />
                  <ReferrersChart data={analytics.topReferrers} />
                  <DevicesChart data={analytics.devices} />
                  <LocationsTable data={analytics.countries} />
                </div>
              </>
            ) : (
              <p className="text-card-foreground/50 py-12 text-center">
                No analytics data available
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="text-card-foreground flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Link not found</p>
          <p className="mt-1 text-sm font-light opacity-70">
            This link may have been deleted or you don&apos;t have access to it.
          </p>
          <Link
            href="/dashboard"
            className="bg-primary hover:bg-primary/90 mt-6 rounded-[48px] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
