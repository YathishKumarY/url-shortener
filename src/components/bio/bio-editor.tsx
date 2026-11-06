"use client";

import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  AtSign,
  CircleCheck,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Link2,
  LoaderCircle,
  Palette,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { BioAvatar } from "@/components/bio/bio-avatar";
import { BioProfile, type BioProfileLink } from "@/components/bio/bio-profile";
import { LinksEditor } from "@/components/bio/links-editor";
import { PhoneFrame } from "@/components/bio/phone-frame";
import {
  displaySocialHref,
  parseSocials,
  SOCIAL_KEYS,
  SOCIAL_PLATFORMS,
  socialHref,
  type BioSocials,
  type SocialKey,
} from "@/components/bio/socials";
import { ThemePicker } from "@/components/bio/theme-picker";
import {
  DEFAULT_BIO_THEME,
  getBioTheme,
  isBioThemeId,
  type BioThemeId,
} from "@/components/bio/themes";
import {
  BIO_MAX,
  bioLinkTitle,
  DISPLAY_NAME_MAX,
  HANDLE_MAX,
  initialsFor,
  safeImageUrl,
} from "@/components/bio/utils";
import {
  Field,
  inputClass,
  PageHeader,
  Panel,
  PanelHeader,
  pill,
  ToggleRow,
} from "@/components/shared/ui-kit";
import {
  useSaveBio,
  type BioLinkItem,
  type BioPageData,
  type BioResponse,
  type SaveBioInput,
} from "@/hooks/use-bio";
import { ApiError } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { cn, copyToClipboard } from "@/lib/utils";

/* ---------------------------------------------------------------- model */

export interface BioEditorUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

type SocialDraft = Record<SocialKey, string>;

interface Draft {
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  theme: BioThemeId;
  socials: SocialDraft;
  published: boolean;
  /** Ordered ids of featured links. */
  featured: string[];
}

type FieldKey = "slug" | "displayName" | "bio" | "avatarUrl" | `social.${SocialKey}`;
type FieldErrors = Partial<Record<FieldKey, string>>;

const SOCIAL_MAX = 300;

const FIELD_IDS: Record<"slug" | "displayName" | "bio" | "avatarUrl", string> = {
  slug: "bio-slug",
  displayName: "bio-display-name",
  bio: "bio-text",
  avatarUrl: "bio-avatar",
};

function fieldId(key: FieldKey): string {
  return key.startsWith("social.")
    ? `bio-social-${key.slice(7)}`
    : FIELD_IDS[key as keyof typeof FIELD_IDS];
}

function emptySocials(): SocialDraft {
  return Object.fromEntries(SOCIAL_KEYS.map((key) => [key, ""])) as SocialDraft;
}

function featuredFrom(links: BioLinkItem[]): string[] {
  return links
    .filter((link) => link.bioPinned)
    .sort((a, b) => a.bioPosition - b.bioPosition)
    .map((link) => link.id);
}

function draftFromPage(page: BioPageData, featured: string[]): Draft {
  return {
    slug: page.slug,
    displayName: page.displayName ?? "",
    bio: page.bio ?? "",
    avatarUrl: page.avatarUrl ?? "",
    theme: isBioThemeId(page.theme) ? page.theme : DEFAULT_BIO_THEME,
    socials: { ...emptySocials(), ...parseSocials(page.socials) },
    published: page.published,
    featured,
  };
}

/** "José Núñez" -> "josenunez": lower-case with disallowed characters stripped. */
export function suggestHandle(user: BioEditorUser | null): string {
  const source = user?.name?.trim() || user?.email?.split("@")[0] || "";
  const handle = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, HANDLE_MAX);
  return handle.length >= 3 ? handle : "";
}

function initialDraft(data: BioResponse, user: BioEditorUser | null): Draft {
  const featured = featuredFrom(data.links);
  if (data.page) return draftFromPage(data.page, featured);
  return {
    slug: suggestHandle(user),
    displayName: user?.name?.trim().slice(0, DISPLAY_NAME_MAX) ?? "",
    bio: "",
    avatarUrl: "",
    theme: DEFAULT_BIO_THEME,
    socials: emptySocials(),
    published: true,
    featured,
  };
}

/** The request body for a draft: trimmed, nulls for empty, unknown links dropped. */
function toPayload(draft: Draft, linkIds: Set<string>): SaveBioInput {
  const socials: BioSocials = {};
  for (const key of SOCIAL_KEYS) {
    const value = draft.socials[key].trim();
    if (value) socials[key] = value;
  }
  return {
    slug: draft.slug.trim().toLowerCase(),
    displayName: draft.displayName.trim() || null,
    bio: draft.bio.trim() || null,
    avatarUrl: draft.avatarUrl.trim() || null,
    theme: draft.theme,
    socials: Object.keys(socials).length > 0 ? socials : null,
    published: draft.published,
    links: draft.featured.filter((id) => linkIds.has(id)),
  };
}

function validate(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};

  const slug = draft.slug.trim().toLowerCase();
  if (!slug) errors.slug = "Choose a handle for your page address";
  else if (/[^a-z0-9_.-]/.test(slug))
    errors.slug = "Use only letters, numbers, dots, dashes and underscores";
  else if (slug.length < 3) errors.slug = "Use at least 3 characters";
  else if (slug.length > HANDLE_MAX) errors.slug = `Use at most ${HANDLE_MAX} characters`;

  if (draft.displayName.trim().length > DISPLAY_NAME_MAX) {
    errors.displayName = `Keep it to ${DISPLAY_NAME_MAX} characters`;
  }
  if (draft.bio.trim().length > BIO_MAX) errors.bio = `Keep it to ${BIO_MAX} characters`;

  const avatar = draft.avatarUrl.trim();
  if (avatar && !safeImageUrl(avatar))
    errors.avatarUrl = "Use a full image link that starts with https://";

  for (const key of SOCIAL_KEYS) {
    const value = draft.socials[key].trim();
    if (!value) continue;
    if (value.length > SOCIAL_MAX)
      errors[`social.${key}`] = `Keep it under ${SOCIAL_MAX} characters`;
    else if (!socialHref(key, value)) {
      errors[`social.${key}`] =
        key === "email"
          ? "Enter an email address like jane@example.com"
          : key === "website"
            ? "Enter a link like janedoe.com or https://janedoe.com"
            : "Enter a username or a full https:// link";
    }
  }
  return errors;
}

/** Map a failed save to field errors plus a message for the toast. */
function errorsFromApi(err: unknown): { fields: FieldErrors; message: string } {
  if (!(err instanceof ApiError)) {
    return { fields: {}, message: err instanceof Error ? err.message : "Could not save your page" };
  }
  const fields: FieldErrors = {};
  if (err.status === 409) {
    fields.slug = err.message || "That handle is already taken";
  } else if (err.status === 400) {
    const server = err.fieldErrors ?? {};
    for (const key of ["slug", "displayName", "bio", "avatarUrl"] as const) {
      if (server[key]?.[0]) fields[key] = server[key][0];
    }
    // "That handle is reserved" arrives without field errors.
    if (Object.keys(fields).length === 0 && /handle/i.test(err.message)) fields.slug = err.message;
  }
  return { fields, message: err.message };
}

/* ---------------------------------------------------------------- hooks */

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const noopSubscribe = () => () => {};

/** The app's origin in the browser ("" during server rendering). */
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

/* ------------------------------------------------------------ fragments */

/** `Field` with ids wired up, so inputs can reference their message. */
function FormField({
  id,
  label,
  error,
  hint,
  trailing,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const message = error ? (
    <span id={`${id}-message`} className="text-destructive">
      {error}
    </span>
  ) : hint ? (
    <span id={`${id}-message`}>{hint}</span>
  ) : null;
  return (
    <Field label={label} htmlFor={id} hint={message} trailing={trailing} className={className}>
      {children}
    </Field>
  );
}

function Counter({ id, value, max }: { id: string; value: number; max: number }) {
  const ratio = value / max;
  return (
    <span
      id={id}
      className={cn(
        "text-xs tabular-nums transition-colors",
        ratio >= 1
          ? "text-destructive"
          : ratio >= 0.9
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground",
      )}
    >
      {value}/{max}
      <span className="sr-only"> characters</span>
    </span>
  );
}

function IntroCard() {
  const steps = ["Claim a handle", "Pick a theme", "Feature links"];
  return (
    <div className="border-primary/20 relative mb-6 overflow-hidden rounded-2xl border bg-linear-to-br from-[#144ee3]/[0.09] via-transparent to-[#eb568e]/[0.09] p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-[#eb568e]/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3.5 md:items-center md:gap-5">
          <div className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl md:size-12 md:rounded-2xl">
            <Sparkles className="size-5 md:size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-foreground text-base font-semibold">
              Your link-in-bio page, in a minute
            </h2>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
              We suggested a handle from your name. Make it yours, choose a look, and switch on the
              links you want to share. Every click shows up in your analytics.
            </p>
          </div>
        </div>
        <ol className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <li
              key={step}
              className="bg-card/80 text-card-foreground shadow-soft inline-flex h-8 items-center gap-2 rounded-full pr-3 pl-1 text-xs font-medium"
            >
              <span className="bg-primary flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- editor */

export function BioEditor({ data, user }: { data: BioResponse; user: BioEditorUser | null }) {
  const save = useSaveBio();
  const origin = useOrigin();
  const host = origin.replace(/^https?:\/\//, "");

  const [draft, setDraft] = useState<Draft>(() => initialDraft(data, user));
  const [baseline, setBaseline] = useState<Draft>(draft);
  /** The page as last saved here; bridges the gap until the refetch lands. */
  const [savedPage, setSavedPage] = useState<BioPageData | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(() => new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  // Prefer what we just saved until the refetch brings something newer
  // (ISO timestamps from the same serializer compare correctly as strings).
  const page =
    savedPage && (!data.page || savedPage.updatedAt >= data.page.updatedAt) ? savedPage : data.page;
  const isNew = !page;
  const linkIds = useMemo(() => new Set(data.links.map((link) => link.id)), [data.links]);
  const linksById = useMemo(() => new Map(data.links.map((link) => [link.id, link])), [data.links]);

  const payload = useMemo(() => toPayload(draft, linkIds), [draft, linkIds]);
  const baselinePayload = useMemo(() => toPayload(baseline, linkIds), [baseline, linkIds]);
  const dirty = JSON.stringify(payload) !== JSON.stringify(baselinePayload);
  const canSave = (isNew || dirty) && !save.isPending;

  const errors = useMemo(() => validate(draft), [draft]);
  function errorFor(key: FieldKey): string | undefined {
    if (serverErrors[key]) return serverErrors[key];
    const error = errors[key];
    if (!error) return undefined;
    // Bad characters in the handle are worth flagging while typing.
    if (key === "slug" && /[^a-z0-9_.-]/.test(draft.slug.trim())) return error;
    return showAllErrors || touched.has(key) ? error : undefined;
  }

  function update(patch: Partial<Draft>, field?: FieldKey) {
    setDraft((current) => ({ ...current, ...patch }));
    if (field && serverErrors[field]) {
      setServerErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function updateSocial(key: SocialKey, value: string) {
    setDraft((current) => ({ ...current, socials: { ...current.socials, [key]: value } }));
  }

  function touch(key: FieldKey) {
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
  }

  function focusField(key: FieldKey) {
    const element = document.getElementById(fieldId(key));
    element?.focus();
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function handleSave() {
    if (!canSave) return;
    const invalid = Object.keys(errors) as FieldKey[];
    if (invalid.length > 0) {
      setShowAllErrors(true);
      focusField(invalid[0]);
      toast.error(
        invalid.length === 1
          ? "One field needs attention"
          : `${invalid.length} fields need attention`,
      );
      return;
    }

    const submitted = draft;
    const body = payload;
    try {
      const saved = await save.mutateAsync(body);
      const next = draftFromPage(saved, body.links ?? []);
      setSavedPage(saved);
      setBaseline(next);
      // Keep anything typed while the request was in flight.
      setDraft((current) =>
        JSON.stringify(current) === JSON.stringify(submitted) ? next : current,
      );
      setServerErrors({});
      setShowAllErrors(false);
      setTouched(new Set());

      const url = `/@${saved.slug}`;
      toast.success(isNew ? "Your page is ready" : "Changes saved", {
        description: saved.published
          ? `${host || ""}${url}`
          : "Your page is hidden until you publish it.",
        action: saved.published
          ? { label: "View", onClick: () => window.open(url, "_blank", "noopener,noreferrer") }
          : undefined,
      });
    } catch (err) {
      const { fields, message } = errorsFromApi(err);
      setServerErrors(fields);
      const first = Object.keys(fields)[0] as FieldKey | undefined;
      if (first) focusField(first);
      toast.error(message);
    }
  }

  function discard() {
    setDraft(baseline);
    setServerErrors({});
    setShowAllErrors(false);
    setTouched(new Set());
  }

  async function copyPageUrl() {
    if (!page) return;
    const url = `${window.location.origin}/@${page.slug}`;
    if (await copyToClipboard(url))
      toast.success("Page link copied", { description: url.replace(/^https?:\/\//, "") });
    else toast.error("Could not copy the link");
  }

  // Cmd/Ctrl+S saves from anywhere on the page.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void handleSave();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const listener = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);

  /* ---- preview inputs */
  const theme = getBioTheme(draft.theme);
  const debouncedAvatar = useDebounced(draft.avatarUrl, 400);
  const previewAvatar = safeImageUrl(debouncedAvatar) ?? safeImageUrl(user?.image);
  const previewLinks: BioProfileLink[] = draft.featured.flatMap((id) => {
    const link = linksById.get(id);
    return link ? [{ id, title: bioLinkTitle(link), url: link.originalUrl }] : [];
  });
  const previewSocials = parseSocials(draft.socials);
  const previewSlug = draft.slug.trim().toLowerCase();

  const slugError = errorFor("slug");
  const slugValid = !errors.slug && !serverErrors.slug;
  const slugChanged = !!page && previewSlug !== page.slug;
  const avatarError = errorFor("avatarUrl");
  const status: { tone: "busy" | "dirty" | "new" | "clean"; label: string; short: string } =
    save.isPending
      ? { tone: "busy", label: "Saving your page...", short: "Saving..." }
      : isNew
        ? { tone: "new", label: "Not published yet", short: "New page" }
        : dirty
          ? { tone: "dirty", label: "You have unsaved changes", short: "Unsaved" }
          : { tone: "clean", label: "All changes saved", short: "Saved" };

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <PageHeader
        title="Link in bio"
        description="One page for everything you share. Pick a handle, style it, and feature your best links."
        actions={
          <>
            {page && (
              <>
                <span
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium",
                    page.published
                      ? "bg-green-500/12 text-green-700 dark:text-green-400"
                      : "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300",
                  )}
                >
                  {page.published ? <Globe className="size-4" /> : <EyeOff className="size-4" />}
                  {page.published ? "Live" : "Hidden"}
                </span>
                <span className="text-card-foreground inline-flex h-10 items-center gap-1.5 px-1 text-[13px] font-medium">
                  <Eye aria-hidden className="text-muted-foreground size-4" />
                  <span className="tabular-nums">{formatNumber(page.views)}</span>
                  {page.views === 1 ? "view" : "views"}
                </span>
                <button type="button" onClick={copyPageUrl} className={pill.secondary}>
                  <Copy /> Copy URL
                </button>
                {page.published ? (
                  <a
                    href={`/@${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={pill.secondary}
                  >
                    View page <ArrowUpRight />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Publish your page to view it"
                    className={pill.secondary}
                  >
                    View page <ArrowUpRight />
                  </button>
                )}
              </>
            )}
            <a href="#bio-preview" className={cn(pill.secondary, "lg:hidden")}>
              <Eye /> Preview
            </a>
          </>
        }
      />

      {isNew && <IntroCard />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-10">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
          className="flex min-w-0 flex-col gap-5"
        >
          {/* ---- Profile */}
          <Panel>
            <PanelHeader
              icon={UserRound}
              title="Profile"
              description="How you appear at the top of your page."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id={FIELD_IDS.slug}
                label="Handle"
                error={slugError}
                hint={
                  slugChanged ? (
                    <>
                      Your current address{" "}
                      <span className="text-foreground font-medium">/@{page.slug}</span> will stop
                      working.
                    </>
                  ) : (
                    <>
                      Your page lives at{" "}
                      <span className="text-foreground font-medium break-all">
                        {host}/@{previewSlug || "handle"}
                      </span>
                    </>
                  )
                }
              >
                <div
                  className={cn(
                    "bg-input/60 flex h-10 items-center rounded-xl border transition-[border-color,box-shadow] focus-within:ring-3",
                    slugError
                      ? "border-destructive focus-within:ring-destructive/20"
                      : "border-border focus-within:border-primary focus-within:ring-primary/25",
                  )}
                >
                  <span
                    aria-hidden
                    className="text-muted-foreground pl-3 text-sm font-medium select-none"
                  >
                    /@
                  </span>
                  <input
                    id={FIELD_IDS.slug}
                    value={draft.slug}
                    onChange={(event) =>
                      update({ slug: event.target.value.toLowerCase().replace(/^@+/, "") }, "slug")
                    }
                    onBlur={() => touch("slug")}
                    placeholder="yourname"
                    maxLength={HANDLE_MAX}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-invalid={!!slugError}
                    aria-describedby={`${FIELD_IDS.slug}-message`}
                    className="text-foreground placeholder:text-muted-foreground/70 h-full min-w-0 flex-1 bg-transparent pr-3 pl-0.5 text-sm outline-none"
                  />
                  <CircleCheck
                    aria-hidden
                    className={cn(
                      "text-success mr-3 size-4 shrink-0 transition-[opacity,scale] duration-200",
                      slugValid && previewSlug ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    )}
                  />
                </div>
              </FormField>

              <FormField
                id={FIELD_IDS.displayName}
                label="Display name"
                error={errorFor("displayName")}
                trailing={
                  <Counter
                    id={`${FIELD_IDS.displayName}-count`}
                    value={draft.displayName.length}
                    max={DISPLAY_NAME_MAX}
                  />
                }
              >
                <input
                  id={FIELD_IDS.displayName}
                  value={draft.displayName}
                  onChange={(event) => update({ displayName: event.target.value }, "displayName")}
                  onBlur={() => touch("displayName")}
                  placeholder="Jane Doe"
                  maxLength={DISPLAY_NAME_MAX}
                  autoComplete="name"
                  aria-invalid={!!errorFor("displayName")}
                  aria-describedby={`${FIELD_IDS.displayName}-count`}
                  className={inputClass}
                />
              </FormField>

              <FormField
                id={FIELD_IDS.bio}
                label="Bio"
                error={errorFor("bio")}
                className="sm:col-span-2"
                trailing={
                  <Counter id={`${FIELD_IDS.bio}-count`} value={draft.bio.length} max={BIO_MAX} />
                }
              >
                <textarea
                  id={FIELD_IDS.bio}
                  value={draft.bio}
                  onChange={(event) => update({ bio: event.target.value }, "bio")}
                  onBlur={() => touch("bio")}
                  placeholder="Designer and writer. Here is everything I am working on right now."
                  maxLength={BIO_MAX}
                  rows={3}
                  aria-invalid={!!errorFor("bio")}
                  aria-describedby={`${FIELD_IDS.bio}-count`}
                  className={cn(inputClass, "h-auto min-h-[92px] resize-y py-2.5 leading-relaxed")}
                />
              </FormField>

              <FormField
                id={FIELD_IDS.avatarUrl}
                label="Avatar image URL"
                error={avatarError}
                className="sm:col-span-2"
                hint={
                  user?.image
                    ? "Leave empty to use your account photo."
                    : "A square image works best. Leave empty to show your initials."
                }
              >
                <div className="flex items-center gap-3">
                  <BioAvatar
                    src={previewAvatar}
                    initials={initialsFor(draft.displayName.trim() || previewSlug)}
                    className="size-10 shrink-0 text-sm"
                    imageClassName="outline-black/10 dark:outline-white/10"
                    fallbackClassName="bg-linear-to-br from-[#144ee3] to-[#eb568e] text-white"
                  />
                  <input
                    id={FIELD_IDS.avatarUrl}
                    type="url"
                    inputMode="url"
                    value={draft.avatarUrl}
                    onChange={(event) => update({ avatarUrl: event.target.value }, "avatarUrl")}
                    onBlur={() => touch("avatarUrl")}
                    placeholder="https://example.com/me.jpg"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={!!avatarError}
                    aria-describedby={`${FIELD_IDS.avatarUrl}-message`}
                    className={inputClass}
                  />
                </div>
              </FormField>
            </div>
          </Panel>

          {/* ---- Theme */}
          <Panel>
            <PanelHeader
              icon={Palette}
              title="Theme"
              description="Every theme is tuned for contrast on phones and desktops."
            />
            <ThemePicker value={draft.theme} onChange={(value) => update({ theme: value })} />
          </Panel>

          {/* ---- Socials */}
          <Panel>
            <PanelHeader
              icon={AtSign}
              title="Social profiles"
              description="Paste a username or a full link. Empty fields stay hidden."
            />
            <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
              {SOCIAL_PLATFORMS.map((platform) => {
                const key: FieldKey = `social.${platform.key}`;
                const id = fieldId(key);
                const value = draft.socials[platform.key];
                const error = errorFor(key);
                const href = value.trim() ? socialHref(platform.key, value) : null;
                // Only worth echoing when we expanded a bare username.
                const resolved =
                  href && !/^[a-z][a-z0-9+.-]*:/i.test(value.trim()) && platform.key !== "email"
                    ? displaySocialHref(href)
                    : null;
                const Icon = platform.icon;
                return (
                  <FormField
                    key={platform.key}
                    id={id}
                    label={platform.label}
                    error={error}
                    hint={
                      resolved ? <span className="break-all">Links to {resolved}</span> : undefined
                    }
                  >
                    <div className="relative">
                      <Icon
                        aria-hidden
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                      />
                      <input
                        id={id}
                        type={platform.key === "email" ? "email" : "text"}
                        inputMode={
                          platform.key === "email"
                            ? "email"
                            : platform.key === "website"
                              ? "url"
                              : "text"
                        }
                        value={value}
                        onChange={(event) => updateSocial(platform.key, event.target.value)}
                        onBlur={() => touch(key)}
                        placeholder={platform.placeholder}
                        maxLength={SOCIAL_MAX}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-invalid={!!error}
                        aria-describedby={error || resolved ? `${id}-message` : undefined}
                        className={cn(inputClass, "pl-9")}
                      />
                    </div>
                  </FormField>
                );
              })}
            </div>
          </Panel>

          {/* ---- Links */}
          <Panel>
            <PanelHeader
              icon={Link2}
              title="Links"
              description="Choose which short links appear on your page and in what order."
            />
            <LinksEditor
              links={data.links}
              featured={draft.featured}
              onChange={(featured) => update({ featured })}
            />
          </Panel>

          {/* ---- Visibility */}
          <Panel className="p-2">
            <ToggleRow
              icon={draft.published ? Globe : EyeOff}
              title="Published"
              description={
                draft.published
                  ? "Anyone with the link can see your page."
                  : "Hidden. Visitors get a not-found page until you publish again."
              }
              checked={draft.published}
              onCheckedChange={(checked) => update({ published: checked })}
            />
          </Panel>

          {/* ---- Save bar: floats above the mobile theme switcher */}
          <div className="sticky bottom-[5.5rem] z-20 sm:bottom-4">
            <div className="border-border/70 bg-popover/90 flex items-center gap-3 rounded-full border p-1.5 pl-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <span
                className="flex min-w-0 items-center gap-2 text-[13px] font-medium"
                role="status"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    status.tone === "busy" && "bg-primary motion-safe:animate-pulse",
                    status.tone === "dirty" && "bg-amber-500",
                    status.tone === "new" && "bg-primary",
                    status.tone === "clean" && "bg-green-500",
                  )}
                />
                <span className="text-card-foreground truncate sm:hidden">{status.short}</span>
                <span className="text-card-foreground hidden truncate sm:inline">
                  {status.label}
                </span>
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {dirty && !isNew && !save.isPending && (
                  <button type="button" onClick={discard} className={cn(pill.ghost, pill.small)}>
                    Discard
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!canSave}
                  title="Save (Ctrl+S or Cmd+S)"
                  className={cn(pill.primary, "min-w-[8.5rem]")}
                >
                  {save.isPending ? <LoaderCircle className="animate-spin" /> : null}
                  {save.isPending ? "Saving" : isNew ? "Create page" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* ---- Live preview */}
        <aside
          id="bio-preview"
          aria-label="Live preview"
          className="scroll-mt-6 lg:sticky lg:top-6"
        >
          <div className="mb-4 flex items-center justify-between gap-2 px-1">
            <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-green-500 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Live preview
            </p>
            <span className="text-muted-foreground text-xs">{theme.name} theme</span>
          </div>
          <p className="sr-only">A visual preview of your page. It updates as you edit the form.</p>

          {/* Left-aligned on lg so the app's floating theme switcher never covers it. */}
          <PhoneFrame glow={theme.accent} className="lg:ml-0 xl:ml-auto">
            <div aria-hidden className="h-full">
              <BioProfile
                variant="preview"
                slug={previewSlug}
                displayName={draft.displayName}
                bio={draft.bio}
                avatarUrl={previewAvatar}
                theme={draft.theme}
                socials={previewSocials}
                links={previewLinks}
              />
            </div>
          </PhoneFrame>

          <p className="text-muted-foreground mt-4 flex items-center justify-center gap-1.5 px-2 text-center text-xs">
            <Globe aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              {host}/@{previewSlug || "handle"}
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
