"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleAlert,
  Dices,
  Eye,
  EyeOff,
  Frame,
  Ghost,
  Globe2,
  Hash,
  Link2,
  Loader2,
  Lock,
  MessageSquareQuote,
  Pause,
  QrCode,
  Settings2,
  Share2,
  Smartphone,
  Sparkles,
  Split,
  Tags,
  Timer,
  UserRound,
  BarChart3,
  Archive,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { qrImageUrl } from "@/components/dashboard/qr-dialog";
import { SocialPreview } from "@/components/links/social-preview";
import { TagInput } from "@/components/links/tag-input";
import {
  GeoTargetsEditor,
  VariantsEditor,
  type GeoRow,
  type VariantRow,
} from "@/components/links/targeting";
import { UtmBuilder } from "@/components/links/utm-builder";
import { Field, inputClass, Panel, pill, ToggleRow } from "@/components/shared/ui-kit";
import { Switch } from "@/components/ui/switch";
import { useAliasCheck, useCreateLink, useUpdateLink, type LinkPayload } from "@/hooks/use-links";
import { useDomains } from "@/hooks/use-settings";
import { ApiError, apiFetch } from "@/lib/api-client";
import { fromDatetimeLocal, hostnameOf, toDatetimeLocal } from "@/lib/format";
import { cn, copyToClipboard } from "@/lib/utils";
import type { LinkItem } from "@/types";

interface PageMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
}

interface FormState {
  url: string;
  domain: string;
  alias: string;
  emoji: boolean;
  title: string;
  description: string;
  tags: string[];
  passwordEnabled: boolean;
  password: string;
  expiresEnabled: boolean;
  expiresAt: string;
  expiredUrl: string;
  startsEnabled: boolean;
  startsAt: string;
  limitEnabled: boolean;
  maxClicks: string;
  deviceEnabled: boolean;
  iosUrl: string;
  androidUrl: string;
  geoEnabled: boolean;
  geo: GeoRow[];
  abEnabled: boolean;
  variants: VariantRow[];
  ogEnabled: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  redirectType: number;
  forwardQuery: boolean;
  hideReferrer: boolean;
  cloaked: boolean;
  noLog: boolean;
  publicStats: boolean;
  bioPinned: boolean;
  disabled: boolean;
  archived: boolean;
}

function initialState(link?: LinkItem, initialUrl?: string): FormState {
  return {
    url: link?.originalUrl ?? initialUrl ?? "",
    domain: link?.domain ?? "",
    alias: link?.shortCode ?? "",
    emoji: false,
    title: link?.title ?? "",
    description: link?.description ?? "",
    tags: link?.tags.map((t) => t.name) ?? [],
    passwordEnabled: !!link?.hasPassword,
    password: "",
    expiresEnabled: !!link?.expiresAt,
    expiresAt: toDatetimeLocal(link?.expiresAt),
    expiredUrl: link?.expiredUrl ?? "",
    startsEnabled: !!link?.startsAt,
    startsAt: toDatetimeLocal(link?.startsAt),
    limitEnabled: link?.maxClicks !== null && link?.maxClicks !== undefined,
    maxClicks: link?.maxClicks ? String(link.maxClicks) : "",
    deviceEnabled: !!(link?.iosUrl || link?.androidUrl),
    iosUrl: link?.iosUrl ?? "",
    androidUrl: link?.androidUrl ?? "",
    geoEnabled: !!link?.geoTargets,
    geo: Object.entries(link?.geoTargets ?? {}).map(([country, url]) => ({ country, url })),
    abEnabled: !!link?.abVariants,
    variants: link?.abVariants ?? [],
    ogEnabled: !!(link?.ogTitle || link?.ogDescription || link?.ogImage),
    ogTitle: link?.ogTitle ?? "",
    ogDescription: link?.ogDescription ?? "",
    ogImage: link?.ogImage ?? "",
    redirectType: link?.redirectType ?? 302,
    forwardQuery: link?.forwardQuery ?? true,
    hideReferrer: link?.hideReferrer ?? false,
    cloaked: link?.cloaked ?? false,
    noLog: link?.noLog ?? false,
    publicStats: link?.publicStats ?? false,
    bioPinned: link?.bioPinned ?? false,
    disabled: link?.disabled ?? false,
    archived: link?.archived ?? false,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** "example.com/page" -> "https://example.com/page" */
function withScheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function appHost(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).host;
    } catch {
      // fall through
    }
  }
  return typeof window === "undefined" ? "" : window.location.host;
}

/* ------------------------------------------------------------- section */

function Section({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
  children,
  id,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  enabled?: boolean;
  onToggle?: (value: boolean) => void;
  children?: React.ReactNode;
  id?: string;
}) {
  const toggleable = onToggle !== undefined;
  const open = !toggleable || enabled;
  return (
    <div
      id={id}
      className={cn("rounded-xl transition-colors", toggleable && enabled && "bg-secondary/30")}
    >
      <div
        className={cn("flex items-start gap-3 p-3", toggleable && "cursor-pointer")}
        onClick={toggleable ? () => onToggle(!enabled) : undefined}
      >
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            open ? "bg-primary/12 text-primary" : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">{title}</p>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{description}</p>
          )}
        </div>
        {toggleable && (
          <Switch
            checked={!!enabled}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Enable ${title.toLowerCase()}`}
            className="mt-1"
          />
        )}
      </div>
      {open && children && <div className="space-y-3 px-3 pb-3 sm:pl-14">{children}</div>}
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground mb-1 px-3 pt-1 text-[11px] font-semibold tracking-wider uppercase">
      {children}
    </h2>
  );
}

/* ---------------------------------------------------------------- form */

interface LinkFormProps {
  mode: "create" | "edit";
  link?: LinkItem;
  initialUrl?: string;
  onSaved?: (link: LinkItem) => void;
}

export function LinkForm({ mode, link, initialUrl, onSaved }: LinkFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(link, initialUrl));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  // The preview card and title placeholder use the destination's own metadata.
  const [metaUrl, setMetaUrl] = useState(() => (isHttpUrl(form.url) ? form.url.trim() : ""));
  const { data: meta, isFetching: metaLoading } = useQuery<PageMetadata | null>({
    queryKey: ["metadata", metaUrl],
    queryFn: () =>
      apiFetch<PageMetadata>(`/api/metadata?url=${encodeURIComponent(metaUrl)}`).catch(() => null),
    enabled: !!metaUrl,
    staleTime: 5 * 60_000,
  });
  const createLink = useCreateLink();
  const updateLink = useUpdateLink();
  const { data: domains } = useDomains();
  const verifiedDomains = domains?.filter((d) => d.verified) ?? [];
  const host = form.domain || appHost();
  const saving = createLink.isPending || updateLink.isPending;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) setErrors((prev) => ({ ...prev, [key as string]: "" }));
  }

  function loadMetadata(url: string) {
    if (isHttpUrl(url)) setMetaUrl(url.trim());
  }

  const alias = useDebounced(form.alias.trim());
  const aliasChanged =
    mode === "create" ? !!alias : alias !== link?.shortCode || form.domain !== (link?.domain ?? "");
  const aliasCheck = useAliasCheck(alias, form.domain, aliasChanged && !!alias);

  /* ------------------------------------------------------ validation */

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.url.trim()) e.url = "Enter the destination URL";
    else if (!isHttpUrl(form.url)) e.url = "Enter a valid http(s) URL, like https://example.com";
    if (mode === "create" && form.passwordEnabled && !form.password)
      e.password = "Choose a password";
    if (mode === "edit" && form.passwordEnabled && !link?.hasPassword && !form.password)
      e.password = "Choose a password";
    if (form.expiresEnabled && !form.expiresAt) e.expiresAt = "Pick an expiry date";
    if (form.startsEnabled && !form.startsAt) e.startsAt = "Pick a start date";
    if (form.limitEnabled && !(Number(form.maxClicks) >= 1))
      e.maxClicks = "Enter a limit of at least 1";
    if (form.expiredUrl.trim() && !isHttpUrl(form.expiredUrl)) e.expiredUrl = "Enter a valid URL";
    if (form.deviceEnabled) {
      if (form.iosUrl.trim() && !isHttpUrl(form.iosUrl)) e.iosUrl = "Enter a valid URL";
      if (form.androidUrl.trim() && !isHttpUrl(form.androidUrl)) e.androidUrl = "Enter a valid URL";
      if (!form.iosUrl.trim() && !form.androidUrl.trim())
        e.iosUrl = "Add an iOS or Android destination";
    }
    if (form.geoEnabled && form.geo.some((g) => !isHttpUrl(g.url)))
      e.geoTargets = "Every country needs a valid URL";
    if (form.abEnabled) {
      if (form.variants.length < 2) e.abVariants = "Add at least two destinations";
      else if (form.variants.some((v) => !isHttpUrl(v.url)))
        e.abVariants = "Every variant needs a valid URL";
    }
    if (form.ogEnabled && form.ogImage.trim() && !isHttpUrl(form.ogImage))
      e.ogImage = "Enter a valid image URL";
    return e;
  }

  function payload(): LinkPayload & { url: string } {
    const urlOrNull = (v: string) => (v.trim() ? v.trim() : null);
    const p: LinkPayload & { url: string } = {
      url: form.url.trim(),
      title: urlOrNull(form.title),
      description: urlOrNull(form.description),
      tags: form.tags,
      expiresAt: form.expiresEnabled ? fromDatetimeLocal(form.expiresAt) : null,
      expiredUrl: form.expiresEnabled || form.limitEnabled ? urlOrNull(form.expiredUrl) : null,
      startsAt: form.startsEnabled ? fromDatetimeLocal(form.startsAt) : null,
      maxClicks: form.limitEnabled ? Math.floor(Number(form.maxClicks)) : null,
      redirectType: form.redirectType,
      forwardQuery: form.forwardQuery,
      hideReferrer: form.hideReferrer,
      cloaked: form.cloaked,
      noLog: form.noLog,
      publicStats: form.publicStats,
      bioPinned: form.bioPinned,
      iosUrl: form.deviceEnabled ? urlOrNull(form.iosUrl) : null,
      androidUrl: form.deviceEnabled ? urlOrNull(form.androidUrl) : null,
      geoTargets:
        form.geoEnabled && form.geo.length
          ? Object.fromEntries(form.geo.map((g) => [g.country, g.url.trim()]))
          : null,
      abVariants:
        form.abEnabled && form.variants.length >= 2
          ? form.variants.map((v) => ({ url: v.url.trim(), weight: v.weight }))
          : null,
      ogTitle: form.ogEnabled ? urlOrNull(form.ogTitle) : null,
      ogDescription: form.ogEnabled ? urlOrNull(form.ogDescription) : null,
      ogImage: form.ogEnabled ? urlOrNull(form.ogImage) : null,
    };

    if (mode === "create") {
      if (form.alias.trim()) p.customAlias = form.alias.trim();
      else if (form.emoji) p.emoji = true;
      if (form.domain) p.domain = form.domain;
      if (form.passwordEnabled && form.password) p.password = form.password;
      return p;
    }

    if (!link) return p;
    if (form.alias.trim() && form.alias.trim() !== link.shortCode)
      p.customAlias = form.alias.trim();
    if (form.domain !== (link.domain ?? "")) p.domain = form.domain;
    if (!form.passwordEnabled && link.hasPassword) p.password = null;
    else if (form.passwordEnabled && form.password) p.password = form.password;
    // An unchanged expiry that already passed would fail "must be in the future".
    if (
      form.expiresEnabled &&
      p.expiresAt &&
      link.expiresAt &&
      new Date(p.expiresAt).getTime() === new Date(link.expiresAt).getTime()
    ) {
      delete p.expiresAt;
    }
    p.disabled = form.disabled;
    p.archived = form.archived;
    return p;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      toast.error(Object.values(found).find(Boolean));
      return;
    }

    try {
      if (mode === "create") {
        const created = await createLink.mutateAsync(payload());
        await copyToClipboard(created.shortUrl);
        toast.success("Link created and copied", { description: created.displayUrl });
        router.push(`/dashboard/links/${created.id}`);
      } else if (link) {
        const updated = await updateLink.mutateAsync({ id: link.id, ...payload() });
        set("password", "");
        toast.success("Changes saved");
        onSaved?.(updated);
      }
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v[0]])));
      }
      toast.error(err instanceof Error ? err.message : "Could not save the link");
    }
  }

  /* --------------------------------------------------------- preview */

  const previewCode =
    form.alias.trim() ||
    (mode === "edit" && link ? link.shortCode : form.emoji ? "🦊🍕🚀🌙" : "abc1234");
  const previewTitle = (form.ogEnabled && form.ogTitle) || meta?.title || form.title;
  const previewDescription = (form.ogEnabled && form.ogDescription) || meta?.description || "";
  const previewImage = (form.ogEnabled && form.ogImage) || meta?.image || "";

  const enabledFeatures = useMemo(() => {
    const list: Array<{ icon: LucideIcon; label: string }> = [];
    if (form.passwordEnabled) list.push({ icon: Lock, label: "Password" });
    if (form.expiresEnabled) list.push({ icon: Timer, label: "Expires" });
    if (form.startsEnabled) list.push({ icon: CalendarClock, label: "Scheduled" });
    if (form.limitEnabled) list.push({ icon: Hash, label: `Limit ${form.maxClicks || "?"}` });
    if (form.deviceEnabled) list.push({ icon: Smartphone, label: "Device targeting" });
    if (form.geoEnabled) list.push({ icon: Globe2, label: `${form.geo.length} countries` });
    if (form.abEnabled) list.push({ icon: Split, label: `A/B ${form.variants.length}` });
    if (form.ogEnabled) list.push({ icon: MessageSquareQuote, label: "Custom preview" });
    if (form.hideReferrer) list.push({ icon: EyeOff, label: "No referrer" });
    if (form.cloaked) list.push({ icon: Frame, label: "Cloaked" });
    if (form.noLog) list.push({ icon: Ghost, label: "No logging" });
    if (form.publicStats) list.push({ icon: BarChart3, label: "Public stats" });
    if (form.bioPinned) list.push({ icon: UserRound, label: "On bio" });
    return list;
  }, [form]);

  const aliasStatus =
    !aliasChanged || !alias
      ? null
      : aliasCheck.isFetching
        ? "checking"
        : aliasCheck.data?.available
          ? "ok"
          : aliasCheck.data
            ? "taken"
            : null;
  const nowLocal = toDatetimeLocal(new Date().toISOString());

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="min-w-0 space-y-5">
        {/* Destination */}
        <Panel>
          <Field
            label="Destination URL"
            htmlFor="lk-url"
            error={errors.url}
            trailing={
              metaLoading ? (
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
              ) : null
            }
          >
            <div className="relative">
              <Link2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <input
                id="lk-url"
                autoFocus={mode === "create"}
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                onBlur={() => {
                  const fixed = withScheme(form.url);
                  if (fixed !== form.url) set("url", fixed);
                  loadMetadata(fixed);
                }}
                placeholder="https://example.com/a/very/long/link?with=params"
                aria-invalid={!!errors.url}
                className={cn(inputClass, "h-12 pl-10 text-[15px]")}
              />
            </div>
          </Field>
          {meta?.title && (
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 truncate text-xs">
              <Sparkles className="text-primary size-3.5 shrink-0" />
              <span className="truncate">{meta.title}</span>
            </p>
          )}
          <div className="mt-4">
            <UtmBuilder url={form.url} onChange={(url) => set("url", url)} />
          </div>
        </Panel>

        {/* Short link */}
        <Panel>
          <Field
            label="Short link"
            htmlFor="lk-alias"
            error={
              errors.customAlias ||
              errors.domain ||
              (aliasStatus === "taken" ? aliasCheck.data?.reason : null)
            }
            hint={
              mode === "create"
                ? "Leave empty for a random code. Letters, numbers, emoji, - and _."
                : "Changing the alias breaks the old short link."
            }
            trailing={
              aliasStatus === "checking" ? (
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
              ) : aliasStatus === "ok" ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                  <Check className="size-3.5" /> Available
                </span>
              ) : aliasStatus === "taken" ? (
                <span className="text-destructive flex items-center gap-1 text-xs font-medium">
                  <CircleAlert className="size-3.5" /> Unavailable
                </span>
              ) : null
            }
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              {verifiedDomains.length > 0 ? (
                <select
                  value={form.domain}
                  onChange={(e) => set("domain", e.target.value)}
                  aria-label="Domain"
                  className={cn(inputClass, "sm:w-56")}
                >
                  <option value="">{appHost()}</option>
                  {verifiedDomains.map((d) => (
                    <option key={d.id} value={d.hostname}>
                      {d.hostname}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex min-w-0 flex-1">
                <span className="border-border bg-secondary text-muted-foreground flex items-center rounded-l-xl border border-r-0 px-3 text-sm whitespace-nowrap">
                  {host}/
                </span>
                <input
                  id="lk-alias"
                  value={form.alias}
                  onChange={(e) => set("alias", e.target.value.replace(/\s+/g, "-"))}
                  placeholder={form.emoji ? "random emoji" : "my-alias"}
                  aria-invalid={aliasStatus === "taken" || !!errors.customAlias}
                  className={cn(inputClass, "rounded-l-none")}
                />
              </div>
            </div>
          </Field>
          {mode === "create" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  set("alias", "");
                  set("emoji", !form.emoji);
                }}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  form.emoji
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-border text-card-foreground hover:text-foreground",
                )}
              >
                <Dices className="size-3.5" /> Emoji code {form.emoji ? "on" : "off"}
              </button>
              <span className="text-muted-foreground text-xs">
                Short links like {host}/🦊🍕🚀🌙 stand out in posts.
              </span>
            </div>
          )}
        </Panel>

        {/* Details */}
        <Panel className="space-y-4">
          <Field
            label="Title"
            htmlFor="lk-title"
            hint="Only you see this. Defaults to the page title."
          >
            <input
              id="lk-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={meta?.title ?? "Spring campaign landing page"}
              className={inputClass}
            />
          </Field>
          <Field label="Tags">
            <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
          </Field>
          <Field
            label="Notes"
            htmlFor="lk-notes"
            hint="Private notes for you and your future self."
          >
            <textarea
              id="lk-notes"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Where this link is shared, who asked for it..."
              className={cn(inputClass, "h-auto resize-y py-2")}
            />
          </Field>
        </Panel>

        {/* Access */}
        <Panel className="p-2">
          <GroupTitle>Access and lifetime</GroupTitle>
          <Section
            icon={Lock}
            title="Password protection"
            description="Visitors must enter a password before they are redirected."
            enabled={form.passwordEnabled}
            onToggle={(v) => set("passwordEnabled", v)}
          >
            <Field
              label={mode === "edit" && link?.hasPassword ? "New password" : "Password"}
              error={errors.password}
              hint={
                mode === "edit" && link?.hasPassword
                  ? "A password is set. Leave empty to keep it."
                  : undefined
              }
            >
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                  placeholder={
                    mode === "edit" && link?.hasPassword ? "••••••••" : "Choose a password"
                  }
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          </Section>
          <Section
            icon={Timer}
            title="Expiration"
            description="Stop the link at a date and time, optionally sending late visitors elsewhere."
            enabled={form.expiresEnabled}
            onToggle={(v) => set("expiresEnabled", v)}
          >
            <Field label="Expires at" error={errors.expiresAt}>
              <input
                type="datetime-local"
                value={form.expiresAt}
                min={nowLocal}
                onChange={(e) => set("expiresAt", e.target.value)}
                className={inputClass}
              />
            </Field>
          </Section>
          <Section
            icon={Hash}
            title="Click limit"
            description="Self-destruct after a number of clicks. Set 1 for a one-time link. Bots never count."
            enabled={form.limitEnabled}
            onToggle={(v) => set("limitEnabled", v)}
          >
            <Field label="Maximum clicks" error={errors.maxClicks}>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={form.maxClicks}
                onChange={(e) => set("maxClicks", e.target.value)}
                placeholder="100"
                className={cn(inputClass, "sm:w-48")}
              />
            </Field>
          </Section>
          {(form.expiresEnabled || form.limitEnabled) && (
            <div className="px-3 pb-3 sm:pl-14">
              <Field
                label="After expiry or limit, redirect to"
                error={errors.expiredUrl}
                hint="Optional. Without it, visitors see a friendly 'link expired' page."
              >
                <input
                  value={form.expiredUrl}
                  onChange={(e) => set("expiredUrl", e.target.value)}
                  onBlur={() => form.expiredUrl && set("expiredUrl", withScheme(form.expiredUrl))}
                  placeholder="https://example.com/offer-ended"
                  className={inputClass}
                />
              </Field>
            </div>
          )}
          <Section
            icon={CalendarClock}
            title="Schedule"
            description="Publish now, go live later. Early visitors see a countdown."
            enabled={form.startsEnabled}
            onToggle={(v) => set("startsEnabled", v)}
          >
            <Field label="Goes live at" error={errors.startsAt}>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
                className={inputClass}
              />
            </Field>
          </Section>
        </Panel>

        {/* Targeting */}
        <Panel className="p-2">
          <GroupTitle>Smart targeting</GroupTitle>
          <Section
            icon={Smartphone}
            title="Device targeting"
            description="Send iPhone and Android users to app stores or deep links."
            enabled={form.deviceEnabled}
            onToggle={(v) => set("deviceEnabled", v)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="iOS destination" error={errors.iosUrl}>
                <input
                  value={form.iosUrl}
                  onChange={(e) => set("iosUrl", e.target.value)}
                  placeholder="https://apps.apple.com/app/id..."
                  className={inputClass}
                />
              </Field>
              <Field label="Android destination" error={errors.androidUrl}>
                <input
                  value={form.androidUrl}
                  onChange={(e) => set("androidUrl", e.target.value)}
                  placeholder="https://play.google.com/store/apps/details?id=..."
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>
          <Section
            icon={Globe2}
            title="Geo targeting"
            description="Different destinations per visitor country."
            enabled={form.geoEnabled}
            onToggle={(v) => {
              set("geoEnabled", v);
              if (v && form.geo.length === 0) set("geo", [{ country: "US", url: "" }]);
            }}
          >
            <GeoTargetsEditor rows={form.geo} onChange={(rows) => set("geo", rows)} />
            {errors.geoTargets && <p className="text-destructive text-xs">{errors.geoTargets}</p>}
          </Section>
          <Section
            icon={Split}
            title="A/B testing"
            description="Split traffic between destinations and compare how each performs."
            enabled={form.abEnabled}
            onToggle={(v) => {
              set("abEnabled", v);
              if (v && form.variants.length < 2) {
                set("variants", [
                  { url: form.url, weight: 50 },
                  { url: "", weight: 50 },
                ]);
              }
            }}
          >
            <VariantsEditor rows={form.variants} onChange={(rows) => set("variants", rows)} />
            {errors.abVariants && <p className="text-destructive text-xs">{errors.abVariants}</p>}
          </Section>
        </Panel>

        {/* Social */}
        <Panel className="p-2">
          <GroupTitle>Sharing</GroupTitle>
          <Section
            icon={MessageSquareQuote}
            title="Custom social preview"
            description="Your own title, description and image when the link is shared on Slack, X, WhatsApp, LinkedIn..."
            enabled={form.ogEnabled}
            onToggle={(v) => {
              set("ogEnabled", v);
              if (v && !form.ogTitle && !form.ogDescription && !form.ogImage && meta) {
                setForm((prev) => ({
                  ...prev,
                  ogTitle: meta.title ?? "",
                  ogDescription: meta.description ?? "",
                  ogImage: meta.image ?? "",
                }));
              }
            }}
          >
            <Field label="Title">
              <input
                value={form.ogTitle}
                onChange={(e) => set("ogTitle", e.target.value)}
                maxLength={200}
                className={inputClass}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.ogDescription}
                onChange={(e) => set("ogDescription", e.target.value)}
                maxLength={500}
                rows={2}
                className={cn(inputClass, "h-auto resize-y py-2")}
              />
            </Field>
            <Field label="Image URL" error={errors.ogImage} hint="1200x630 px works best.">
              <input
                value={form.ogImage}
                onChange={(e) => set("ogImage", e.target.value)}
                placeholder="https://example.com/card.png"
                className={inputClass}
              />
            </Field>
          </Section>
          <ToggleRow
            icon={BarChart3}
            title="Public stats page"
            description="Anyone can view this link's analytics at /stats/<code>."
            checked={form.publicStats}
            onCheckedChange={(v) => set("publicStats", v)}
          />
          <ToggleRow
            icon={UserRound}
            title="Show on my bio page"
            description="Feature this link on your link-in-bio page."
            checked={form.bioPinned}
            onCheckedChange={(v) => set("bioPinned", v)}
          />
        </Panel>

        {/* Advanced */}
        <Panel className="p-2">
          <GroupTitle>Advanced</GroupTitle>
          <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Settings2 className="text-muted-foreground mt-0.5 size-4" />
              <div>
                <p className="text-foreground text-sm font-medium">Redirect type</p>
                <p className="text-muted-foreground text-xs">
                  {form.redirectType === 301 || form.redirectType === 308
                    ? "Permanent: browsers cache it, so repeat visits skip analytics and edits may not apply."
                    : "Temporary: every visit is counted and the destination can change any time."}
                </p>
              </div>
            </div>
            <select
              value={form.redirectType}
              onChange={(e) => set("redirectType", Number(e.target.value))}
              aria-label="Redirect type"
              className={cn(inputClass, "sm:w-56")}
            >
              <option value={302}>302 Found (recommended)</option>
              <option value={307}>307 Temporary</option>
              <option value={301}>301 Permanent</option>
              <option value={308}>308 Permanent</option>
            </select>
          </div>
          <ToggleRow
            icon={Share2}
            title="Forward query parameters"
            description="?ref=x on the short link is passed through to the destination."
            checked={form.forwardQuery}
            onCheckedChange={(v) => set("forwardQuery", v)}
          />
          <ToggleRow
            icon={EyeOff}
            title="Hide referrer"
            description="The destination cannot see where the visitor came from (anonymous redirect)."
            checked={form.hideReferrer}
            onCheckedChange={(v) => set("hideReferrer", v)}
          />
          <ToggleRow
            icon={Frame}
            title="Link cloaking"
            description="Keep your short URL in the address bar by framing the destination."
            checked={form.cloaked}
            onCheckedChange={(v) => set("cloaked", v)}
          />
          <ToggleRow
            icon={Ghost}
            title="Private link (no logging)"
            description="Count clicks, but store nothing about visitors: no location, device, referrer or IP hash."
            checked={form.noLog}
            onCheckedChange={(v) => set("noLog", v)}
          />
          {form.cloaked && (
            <p className="mx-3 mb-2 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Many sites (Google, GitHub, banks...) refuse to be framed and will show a blank page.
              Test before sharing.
            </p>
          )}
          {mode === "edit" && (
            <>
              <ToggleRow
                icon={Pause}
                title="Pause link"
                description="Visitors see a 'link paused' notice until you resume it."
                checked={form.disabled}
                onCheckedChange={(v) => set("disabled", v)}
              />
              <ToggleRow
                icon={Archive}
                title="Archived"
                description="Hidden from your main list. The link keeps working."
                checked={form.archived}
                onCheckedChange={(v) => set("archived", v)}
              />
            </>
          )}
        </Panel>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Panel>
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            Short link
          </p>
          <p className="text-primary text-lg font-semibold break-all">
            {host}/{previewCode}
          </p>
          {mode === "create" && !form.alias.trim() && (
            <p className="text-muted-foreground mt-1 text-xs">
              {form.emoji ? "A random emoji code" : "A random 7-character code"} is assigned when
              you create it.
            </p>
          )}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
              {mode === "edit" && link ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImageUrl(link.shortCode, link.domain, {
                    size: "256",
                    v: String(new Date(link.updatedAt).getTime()),
                  })}
                  alt="QR code"
                  className="size-full"
                />
              ) : (
                <QrCode className="size-10 text-zinc-300" />
              )}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {mode === "edit"
                ? "Download or customize it in the QR code tab."
                : "A QR code is generated for every link, ready to download after saving."}
            </p>
          </div>
        </Panel>

        <Panel>
          <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
            Social preview
          </p>
          <SocialPreview
            title={previewTitle}
            description={previewDescription}
            image={previewImage}
            domain={form.ogEnabled ? host : form.url ? hostnameOf(form.url) : host}
          />
        </Panel>

        {enabledFeatures.length > 0 && (
          <Panel>
            <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Tags className="size-3.5" /> Enabled
            </p>
            <div className="flex flex-wrap gap-1.5">
              {enabledFeatures.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="bg-primary/10 text-primary inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium"
                >
                  <Icon className="size-3.5" />
                  {label}
                </span>
              ))}
            </div>
          </Panel>
        )}

        <div className="bg-background/80 border-border/60 fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t p-3 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {mode === "create" && (
            <button
              type="button"
              onClick={() => router.back()}
              className={cn(pill.secondary, "flex-1")}
            >
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving} className={cn(pill.primary, "flex-[2]")}>
            {saving && <Loader2 className="animate-spin" />}
            {mode === "create" ? "Create link" : "Save changes"}
          </button>
        </div>
      </aside>
    </form>
  );
}
