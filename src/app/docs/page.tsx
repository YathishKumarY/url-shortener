import {
  BookOpen,
  ChartColumn,
  CircleAlert,
  FileJson,
  Gauge,
  KeyRound,
  Link2,
  Route,
  ShieldCheck,
  Signpost,
  Sparkles,
  Tags,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CodeBlock } from "@/components/docs/code-block";
import { CodeTabs } from "@/components/docs/code-tabs";
import { DocsToc, DocsTocMobile, type TocEntry } from "@/components/docs/docs-toc";
import {
  Callout,
  DataTable,
  DocSection,
  Endpoint,
  FieldTable,
  InlineCode,
  Prose,
  SubHeading,
  type FieldRow,
} from "@/components/docs/primitives";
import { json, requestSamples } from "@/components/docs/samples";
import { Footer } from "@/components/landing/footer";
import { CopyIconButton } from "@/components/public/copy-button";
import { Eyebrow } from "@/components/public/eyebrow";
import { PillLink } from "@/components/public/pill-link";
import { incomingRequest } from "@/components/public/request";
import { mono } from "@/components/public/styles";
import { Navbar } from "@/components/shared/navbar";
import { getAppOrigin } from "@/lib/app-url";
import { config } from "@/lib/config";
import { buildOpenApiSpec } from "@/lib/openapi";
import { cn } from "@/lib/utils";
import {
  BULK_ACTIONS,
  LINK_STATUSES,
  REPORT_REASONS,
  STATS_PERIODS,
  TAG_COLORS,
  WEBHOOK_EVENTS,
} from "@/lib/validators";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API documentation",
  description:
    "Create short links, manage them in bulk, read click analytics and receive webhooks with the Linkly REST API.",
};

const TOC: TocEntry[] = [
  { id: "introduction", label: "Introduction" },
  { id: "authentication", label: "Authentication" },
  { id: "rate-limits", label: "Rate limits" },
  { id: "quick-shorten", label: "Quick shorten" },
  {
    id: "links",
    label: "Links",
    children: [
      { id: "list-links", label: "List links" },
      { id: "create-link", label: "Create a link" },
      { id: "get-link", label: "Get a link" },
      { id: "update-link", label: "Update a link" },
      { id: "delete-link", label: "Delete a link" },
      { id: "bulk-create", label: "Bulk create" },
      { id: "bulk-actions", label: "Bulk actions" },
    ],
  },
  { id: "analytics", label: "Analytics" },
  { id: "tags", label: "Tags" },
  { id: "link-object", label: "Link object" },
  { id: "webhooks", label: "Webhooks" },
  { id: "special-urls", label: "Special URLs" },
  { id: "errors", label: "Errors" },
  { id: "abuse", label: "Abuse" },
  { id: "openapi", label: "OpenAPI" },
];

/* ------------------------------------------------------------ link object */

interface SchemaNode {
  type?: string | string[];
  format?: string;
  enum?: readonly unknown[];
  items?: SchemaNode;
  $ref?: string;
  description?: string;
  additionalProperties?: unknown;
}

/** Notes for LinkInput fields the OpenAPI document leaves undescribed. */
const FIELD_NOTES: Record<string, string> = {
  title: "Label shown in your dashboard. Defaults to the destination page title",
  expiresAt: "Stop redirecting at this moment. Must be in the future",
  maxClicks: "Stop redirecting after this many human clicks. 1 makes a one-time link",
  disabled: "Pause the link. Visitors see a notice instead of being redirected",
  archived: "Hide the link from the default list. It keeps redirecting",
  redirectType: "HTTP status used for the redirect. Defaults to 302",
  hideReferrer: "Do not tell the destination which page the visitor came from",
  iosUrl: "Destination for visitors on iPhone and iPad",
  androidUrl: "Destination for visitors on Android",
  abVariants:
    "Split visitors between 2 to 5 destinations, each an object with a url and a weight from 1 to 100",
  ogTitle: "Title for link previews in chat and social apps",
  ogDescription: "Description for link previews",
  ogImage: "Image for link previews",
  publicStats: "Let anyone see this link's analytics at /stats/{code}",
};

/** Extra detail appended to a field's own description. */
const FIELD_EXTRA: Record<string, string> = {
  customAlias: "3 to 50 characters, or a single emoji",
  tags: "On update, replaces the link's tags",
  password: "Write-only: responses include hasPassword instead",
  geoTargets: 'For example { "US": "https://example.com/us" }',
};

function typeLabel(schema: SchemaNode): string {
  if (schema.$ref) return schema.$ref.split("/").pop() ?? "object";
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const label = schema.enum
    ? schema.enum.map(String).join(" | ")
    : types
        .filter((type) => type !== "null")
        .map((type) => {
          if (type === "array") return `${typeLabel(schema.items ?? {})}[]`;
          if (type === "object") return "object";
          if (type === "string" && schema.format === "uri") return "string (URL)";
          if (type === "string" && schema.format === "date-time") return "string (ISO 8601)";
          return type;
        })
        .join(" | ") || "any";
  return types.includes("null") ? `${label} | null` : label;
}

function sentence(...parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => !!part)
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(" ");
}

function linkInputRows(origin: string): FieldRow[] {
  const schema = buildOpenApiSpec(origin).components.schemas.LinkInput as unknown as {
    required?: string[];
    properties: Record<string, SchemaNode>;
  };
  return Object.entries(schema.properties).map(([name, field]) => ({
    name,
    type: typeLabel(field),
    required: schema.required?.includes(name),
    description: sentence(field.description ?? FIELD_NOTES[name], FIELD_EXTRA[name]),
  }));
}

const READ_ONLY_FIELDS: FieldRow[] = [
  { name: "id", type: "string", description: "Identifier used in /links/{id} paths." },
  { name: "shortUrl", type: "string (URL)", description: "The full short URL, ready to share." },
  {
    name: "displayUrl",
    type: "string",
    description: "The short URL without the scheme, for display.",
  },
  {
    name: "status",
    type: "string",
    description: "active, scheduled, expired, limited (click limit reached), disabled or banned.",
  },
  { name: "hasPassword", type: "boolean", description: "Whether visitors need a password." },
  {
    name: "clickCount",
    type: "integer",
    description: "Human clicks so far. Bots are not counted.",
  },
  { name: "lastClickedAt", type: "string | null", description: "Time of the most recent click." },
  {
    name: "banned",
    type: "boolean",
    description: "Set when a moderator blocked the link. bannedReason explains why.",
  },
  { name: "tags", type: "Tag[]", description: "Tags as objects with id, name and color." },
  { name: "createdAt", type: "string", description: "Creation time, ISO 8601 in UTC." },
  { name: "updatedAt", type: "string", description: "Last change, ISO 8601 in UTC." },
];

/* --------------------------------------------------------------- helpers */

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="text-card-foreground marker:text-primary/70 list-disc space-y-2 pl-5 text-[15px] leading-7">
      {children}
    </ul>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group border-border/60 bg-card/70 shadow-soft hover:border-primary/40 focus-visible:ring-ring/50 rounded-2xl border p-5 backdrop-blur-sm transition-[border-color,transform] duration-200 outline-none hover:-translate-y-0.5 focus-visible:ring-3"
    >
      <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="text-foreground mt-4 block text-[15px] font-semibold">{title}</span>
      <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">{children}</span>
    </a>
  );
}

/* ------------------------------------------------------------------ page */

export default async function DocsPage() {
  // Examples use this instance's own address. Reading the request makes the
  // page dynamic, which also keeps runtime config (limits, flags) current.
  const origin = getAppOrigin(await incomingRequest());
  const host = origin.replace(/^https?:\/\//, "");
  const api = `${origin}/api/v1`;
  const exampleId = "cm3k9x2ab0001lk08f4h2q7rd";
  const anonymousAllowed = !config.anonymousLinksDisabled;
  const bulkLimit = config.bulkLimit;

  const exampleLink = {
    id: exampleId,
    domain: null,
    shortCode: "launch",
    shortUrl: `${origin}/launch`,
    displayUrl: `${host}/launch`,
    originalUrl: "https://example.com/products/launch?ref=newsletter",
    customAlias: "launch",
    title: "Launch day",
    hasPassword: false,
    expiresAt: "2027-01-31T23:59:59.000Z",
    maxClicks: null,
    status: "active",
    clickCount: 0,
    tags: [{ id: "cm3k9x2ab0002lk08a1b2c3d4", name: "launch", color: "blue" }],
    createdAt: "2026-11-06T09:30:00.000Z",
    updatedAt: "2026-11-06T09:30:00.000Z",
  };

  const verifySnippet = `import { createHmac, timingSafeEqual } from "node:crypto";

/** True when X-Linkly-Signature matches the raw request body. */
export function verifyLinklySignature(rawBody, signature, secret) {
  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex"),
  );
  const received = Buffer.from(signature ?? "");
  // timingSafeEqual throws on different lengths, so compare those first.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Express: read the body as raw bytes, verify, then parse.
app.post("/webhooks/linkly", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.get("X-Linkly-Signature");
  if (!verifyLinklySignature(req.body, signature, process.env.LINKLY_WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid signature");
  }
  const { id, event, data } = JSON.parse(req.body.toString("utf8"));
  console.log(id, event, data);
  res.sendStatus(204);
});`;

  return (
    <div className="bg-background relative flex min-h-dvh flex-col overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-16 h-[500px] w-[500px] opacity-60"
      >
        <div className="cube absolute bottom-0 left-0 h-[200px] w-[200px]" />
        <div className="cube absolute top-4 right-8 h-[155px] w-[155px]" />
        <div className="cube absolute right-0 bottom-8 h-[200px] w-[200px]" />
      </div>

      <Navbar />

      <main className="relative z-10 flex-1 px-4 pb-24 sm:px-6 md:px-12">
        <div className="mx-auto w-full max-w-6xl">
          {/* ---------------------------------------------------------- hero */}
          <header className="max-w-3xl pt-6 sm:pt-10">
            <Eyebrow icon={BookOpen}>Developer documentation</Eyebrow>
            <h1 className="mt-5 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
              <span className="gradient-title">{config.siteName} API</span>
            </h1>
            <p className="text-card-foreground mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
              Shorten links, manage them in bulk, read click analytics and react to events as they
              happen. Everything the dashboard does is available over a small JSON API.
            </p>
            <div className="border-border/60 bg-card/70 shadow-soft mt-6 flex max-w-full items-center gap-3 rounded-2xl border py-1.5 pr-1.5 pl-4 backdrop-blur-sm sm:inline-flex">
              <span className="text-muted-foreground shrink-0 text-xs font-medium">Base URL</span>
              <code className={cn(mono, "text-foreground min-w-0 flex-1 text-sm break-all")}>
                {api}
              </code>
              <CopyIconButton text={api} label="Copy base URL" size="sm" />
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <PillLink href="/dashboard/settings">
                <KeyRound />
                Get an API key
              </PillLink>
              <PillLink href="/api/v1/openapi.json" native variant="secondary">
                <FileJson />
                OpenAPI spec
              </PillLink>
            </div>
          </header>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <QuickCard href="#quick-shorten" icon={Zap} title="Shorten in one call">
              One GET request with a plain-text answer. Made for scripts and shell aliases.
            </QuickCard>
            <QuickCard href="#analytics" icon={ChartColumn} title="Track every click">
              Time series, referrers, locations and devices for any period, in your timezone.
            </QuickCard>
            <QuickCard href="#webhooks" icon={Webhook} title="Get notified">
              Signed webhooks when links are created, updated, deleted or clicked.
            </QuickCard>
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] xl:gap-14">
            <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-6">
              <DocsToc entries={TOC} />
            </aside>

            <div className="max-w-3xl min-w-0">
              <div className="mb-10 lg:hidden">
                <DocsTocMobile entries={TOC} />
              </div>

              <div className="space-y-12">
                {/* ------------------------------------------------ intro */}
                <DocSection id="introduction" title="Introduction" icon={Sparkles}>
                  <Prose>
                    The API is organised around REST. Every endpoint lives under{" "}
                    <InlineCode>/api/v1</InlineCode>, requests and responses are JSON, and you
                    authenticate with an API key sent as a bearer token. Timestamps are ISO 8601
                    strings in UTC.
                  </Prose>
                  <List>
                    <li>IDs are opaque strings. Store them as they are.</li>
                    <li>
                      When updating, send only the fields you want to change.{" "}
                      <InlineCode>null</InlineCode> clears an optional field.
                    </li>
                    <li>
                      Errors come back as JSON with an <InlineCode>error</InlineCode> message and a
                      meaningful HTTP status.
                    </li>
                  </List>
                  <SubHeading>Your first request</SubHeading>
                  <Prose>Create a short link with a custom back-half:</Prose>
                  <CodeTabs
                    samples={requestSamples({
                      method: "POST",
                      url: `${api}/links`,
                      body: { url: exampleLink.originalUrl, customAlias: "launch" },
                      name: "link",
                    })}
                  />
                  <CodeBlock label="Response 201 (abridged)" code={json(exampleLink)} />
                </DocSection>

                {/* --------------------------------------- authentication */}
                <DocSection id="authentication" title="Authentication" icon={KeyRound}>
                  <Prose>
                    Create an API key in the dashboard under{" "}
                    <strong className="text-foreground font-semibold">
                      Settings &gt; API keys
                    </strong>
                    . The full key is shown once, so put it somewhere safe such as a secrets
                    manager; only a hash is stored. Keys start with <InlineCode>lk_</InlineCode> and
                    can be given an expiry date.
                  </Prose>
                  <Prose>Send the key in the Authorization header of every request:</Prose>
                  <CodeBlock label="Header" code="Authorization: Bearer lk_..." />
                  <CodeTabs
                    samples={requestSamples({
                      method: "GET",
                      url: `${api}/links`,
                      query: { limit: 5 },
                    })}
                  />
                  <Prose>
                    A missing, malformed, expired or revoked key gets a <InlineCode>401</InlineCode>
                    . Requests from a signed-in browser session are accepted too, which is how the
                    dashboard talks to the same endpoints.
                  </Prose>
                  <Callout tone="warning" title="Keep keys on the server">
                    A key can create, edit and delete every link on your account. Never ship it in
                    browser or mobile app code. If one leaks, revoke it on the same settings page;
                    it stops working immediately.
                  </Callout>
                </DocSection>

                {/* ------------------------------------------- rate limits */}
                <DocSection id="rate-limits" title="Rate limits" icon={Gauge}>
                  <Prose>
                    Limits use a sliding window. Go over one and the API answers{" "}
                    <InlineCode>429 Too Many Requests</InlineCode> with these headers:
                  </Prose>
                  <FieldTable
                    nameHeader="Header"
                    showType={false}
                    caption="Rate limit headers"
                    rows={[
                      { name: "X-RateLimit-Limit", description: "Requests allowed in the window." },
                      {
                        name: "X-RateLimit-Remaining",
                        description: "Requests left in the current window.",
                      },
                      {
                        name: "X-RateLimit-Reset",
                        description:
                          "When the window frees up, as a Unix timestamp in milliseconds.",
                      },
                      {
                        name: "Retry-After",
                        description:
                          "Seconds to wait before trying again. Sent with 429 responses.",
                      },
                    ]}
                  />
                  <DataTable
                    caption="Rate limits by action"
                    headers={["Action", "Limit", "Counted per"]}
                    rows={[
                      [
                        "Creating links without an API key",
                        "10 per minute (RATE_LIMIT_ANON_CREATE)",
                        "IP address",
                      ],
                      [
                        "Writes with a key or session (create, update, bulk create)",
                        "120 per minute",
                        "User",
                      ],
                      [
                        "Opening short links (redirects)",
                        "600 per minute (RATE_LIMIT_REDIRECTS)",
                        "IP address",
                      ],
                      ["Public stats and alias checks", "300 per minute", "IP address"],
                      [
                        "Password attempts on protected links",
                        "10 per 5 minutes",
                        "IP address and link",
                      ],
                      ["Abuse reports", "5 per hour", "IP address"],
                    ]}
                  />
                  <CodeBlock
                    label="Response 429"
                    code={`HTTP/1.1 429 Too Many Requests
Retry-After: 12
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1794132000000

{"error":"Too many requests. Please try again later."}`}
                  />
                  <Prose>
                    Successful link creation responses carry the{" "}
                    <InlineCode>X-RateLimit-*</InlineCode> headers too, so batch jobs can slow down
                    before they reach the limit.
                  </Prose>
                </DocSection>

                {/* ----------------------------------------- quick shorten */}
                <DocSection id="quick-shorten" title="Quick shorten" icon={Zap}>
                  <Endpoint method="GET" path="/api/v1/shorten" summary="Shorten a URL in one call">
                    <Prose>
                      The fastest way to shorten a URL: one request and no JSON to build. With{" "}
                      <InlineCode>format=simple</InlineCode> the response body is just the short URL
                      and a newline, which suits shell scripts, bookmarklets and chat bots.
                    </Prose>
                    {anonymousAllowed ? (
                      <Callout title="Works without an API key on this instance">
                        Anonymous links get the options below and nothing more. Send your key to
                        create the link on your account, so you can edit it and see its stats later.
                      </Callout>
                    ) : (
                      <Callout tone="warning" title="API key required on this instance">
                        This instance has turned off anonymous links, so quick shorten needs an API
                        key like every other endpoint.
                      </Callout>
                    )}
                    <FieldTable
                      caption="Quick shorten parameters"
                      rows={[
                        {
                          name: "url",
                          type: "string",
                          required: true,
                          description: "The URL to shorten. http and https only.",
                        },
                        {
                          name: "format",
                          type: "json | simple",
                          description:
                            "simple returns plain text. Defaults to json, the full link object.",
                        },
                        {
                          name: "alias",
                          type: "string",
                          description: "Custom back-half: 3 to 50 letters, numbers, emoji, - or _.",
                        },
                        {
                          name: "emoji",
                          type: "1",
                          description: "Generate an emoji code instead of letters and numbers.",
                        },
                        {
                          name: "password",
                          type: "string",
                          description: "Visitors must enter it before they are redirected.",
                        },
                        {
                          name: "maxClicks",
                          type: "integer",
                          description:
                            "Stop redirecting after this many clicks. 1 makes a one-time link.",
                        },
                        {
                          name: "expiresAt",
                          type: "string (ISO 8601)",
                          description: "Stop redirecting at this moment. Must be in the future.",
                        },
                      ]}
                    />
                    <CodeTabs
                      samples={requestSamples({
                        method: "GET",
                        url: `${api}/shorten`,
                        query: { url: "https://example.com/launch", format: "simple" },
                        auth: !anonymousAllowed,
                        result: "text",
                        name: "shortUrl",
                      })}
                    />
                    <CodeBlock label="Response 201 (text/plain)" code={`${origin}/aB3xY9k`} />
                    <Prose>
                      Errors use the format you asked for: a plain-text failure reads like{" "}
                      <InlineCode>Error: Please enter a valid URL</InlineCode>. The same parameters
                      also work as a <InlineCode>POST</InlineCode> with a JSON or form body.
                    </Prose>
                  </Endpoint>
                </DocSection>

                {/* ------------------------------------------------- links */}
                <DocSection id="links" title="Links" icon={Link2}>
                  <Prose>
                    Create, list, update and delete links. Every endpoint here needs an API key,
                    except creating a link on instances that allow anonymous links.
                  </Prose>

                  <Endpoint id="list-links" method="GET" path="/api/v1/links" summary="List links">
                    <Prose>Newest first, 20 per page by default.</Prose>
                    <FieldTable
                      caption="List links query parameters"
                      rows={[
                        { name: "page", type: "integer", description: "Page number, from 1." },
                        {
                          name: "limit",
                          type: "integer",
                          description: "Links per page, up to 100. Defaults to 20.",
                        },
                        {
                          name: "search",
                          type: "string",
                          description: "Matches the short code, destination, title and notes.",
                        },
                        {
                          name: "status",
                          type: "string",
                          description: `One of ${LINK_STATUSES.join(", ")}. Defaults to all, which leaves out archived links.`,
                        },
                        {
                          name: "tag",
                          type: "string",
                          description: "Only links with this tag id.",
                        },
                        {
                          name: "domain",
                          type: "string",
                          description: "A custom domain hostname, or default for the main domain.",
                        },
                        {
                          name: "sort",
                          type: "string",
                          description: "createdAt (default), clicks, lastClickedAt or title.",
                        },
                        { name: "order", type: "string", description: "desc (default) or asc." },
                      ]}
                    />
                    <CodeTabs
                      samples={requestSamples({
                        method: "GET",
                        url: `${api}/links`,
                        query: { status: "active", sort: "clicks", limit: 50 },
                        name: "page",
                      })}
                    />
                    <CodeBlock
                      label="Response 200"
                      code={json({
                        links: [
                          {
                            id: exampleId,
                            shortCode: "launch",
                            shortUrl: exampleLink.shortUrl,
                            originalUrl: exampleLink.originalUrl,
                            status: "active",
                            clickCount: 1284,
                          },
                        ],
                        total: 1,
                        page: 1,
                        limit: 50,
                        pageSize: 50,
                        totalPages: 1,
                      })}
                    />
                  </Endpoint>

                  <Endpoint
                    id="create-link"
                    method="POST"
                    path="/api/v1/links"
                    summary="Create a link"
                  >
                    <Prose>
                      Send a{" "}
                      <a href="#link-object" className="text-primary font-medium hover:underline">
                        link object
                      </a>
                      . Only <InlineCode>url</InlineCode> is required. Returns{" "}
                      <InlineCode>201</InlineCode> with the new link, or{" "}
                      <InlineCode>409</InlineCode> when the custom alias is taken.
                    </Prose>
                    <CodeTabs
                      samples={requestSamples({
                        method: "POST",
                        url: `${api}/links`,
                        body: {
                          url: exampleLink.originalUrl,
                          customAlias: "launch",
                          title: "Launch day",
                          tags: ["launch", "q4"],
                          expiresAt: "2027-01-31T23:59:59Z",
                        },
                        name: "link",
                      })}
                    />
                  </Endpoint>

                  <Endpoint
                    id="get-link"
                    method="GET"
                    path="/api/v1/links/{id}"
                    summary="Get a link"
                  >
                    <Prose>Returns one of your links by id, or 404 if it is not yours.</Prose>
                    <CodeTabs
                      samples={requestSamples({
                        method: "GET",
                        url: `${api}/links/${exampleId}`,
                        name: "link",
                      })}
                    />
                  </Endpoint>

                  <Endpoint
                    id="update-link"
                    method="PATCH"
                    path="/api/v1/links/{id}"
                    summary="Update a link"
                  >
                    <Prose>
                      Send only the fields to change, and <InlineCode>null</InlineCode> to clear an
                      optional one, such as an expiry date or a password. Changing{" "}
                      <InlineCode>url</InlineCode> updates every copy of the short link already out
                      there, printed QR codes included. Links blocked by a moderator answer{" "}
                      <InlineCode>403</InlineCode>.
                    </Prose>
                    <CodeTabs
                      samples={requestSamples({
                        method: "PATCH",
                        url: `${api}/links/${exampleId}`,
                        body: {
                          url: "https://example.com/products/launch-v2",
                          expiresAt: null,
                          password: null,
                        },
                        name: "link",
                      })}
                    />
                  </Endpoint>

                  <Endpoint
                    id="delete-link"
                    method="DELETE"
                    path="/api/v1/links/{id}"
                    summary="Delete a link"
                  >
                    <Prose>
                      Responds <InlineCode>204 No Content</InlineCode>. The short code becomes free
                      again and the link&apos;s analytics are deleted with it.
                    </Prose>
                    <CodeTabs
                      samples={requestSamples({
                        method: "DELETE",
                        url: `${api}/links/${exampleId}`,
                        result: "none",
                      })}
                    />
                  </Endpoint>

                  <Endpoint
                    id="bulk-create"
                    method="POST"
                    path="/api/v1/links/bulk"
                    summary="Create links in bulk"
                  >
                    <Prose>
                      Create up to {bulkLimit} links in one request. Each item takes{" "}
                      <InlineCode>url</InlineCode>, <InlineCode>customAlias</InlineCode>,{" "}
                      <InlineCode>title</InlineCode> and <InlineCode>tags</InlineCode>; top-level{" "}
                      <InlineCode>tags</InlineCode> are added to every link. Items are processed in
                      order and succeed or fail on their own, so check each result. The status is{" "}
                      <InlineCode>201</InlineCode> when at least one link was created.
                    </Prose>
                    <CodeTabs
                      samples={requestSamples({
                        method: "POST",
                        url: `${api}/links/bulk`,
                        body: {
                          tags: ["newsletter"],
                          links: [
                            { url: "https://example.com/spring", customAlias: "spring" },
                            { url: "https://example.com/summer", title: "Summer sale" },
                            { url: "https://example.com/autumn", customAlias: "launch" },
                          ],
                        },
                        name: "result",
                      })}
                    />
                    <CodeBlock
                      label="Response 201"
                      code={json({
                        created: 2,
                        failed: 1,
                        results: [
                          {
                            index: 0,
                            ok: true,
                            link: { id: "cm3k9x2ab0003lk08", shortUrl: `${origin}/spring` },
                          },
                          {
                            index: 1,
                            ok: true,
                            link: { id: "cm3k9x2ab0004lk08", shortUrl: `${origin}/k7Qp2Zx` },
                          },
                          { index: 2, ok: false, error: "This alias is already taken" },
                        ],
                      })}
                    />
                  </Endpoint>

                  <Endpoint
                    id="bulk-actions"
                    method="PATCH"
                    path="/api/v1/links/bulk"
                    summary="Apply an action to many links"
                  >
                    <Prose>
                      Send up to 500 link <InlineCode>ids</InlineCode> and one{" "}
                      <InlineCode>action</InlineCode>. Ids you do not own are skipped. The response
                      says how many links were affected.
                    </Prose>
                    <FieldTable
                      nameHeader="Action"
                      showType={false}
                      caption="Bulk actions"
                      rows={BULK_ACTIONS.map((action) => ({
                        name: action,
                        description: {
                          delete: "Delete the links and their analytics.",
                          archive: "Hide the links from the default list. They keep redirecting.",
                          unarchive: "Bring archived links back into the default list.",
                          disable: "Pause the links. Visitors see a notice instead.",
                          enable: "Switch paused links back on.",
                          addTag: "Add the tag named in tag, creating it if needed.",
                          removeTag: "Remove the tag named in tag.",
                        }[action],
                      }))}
                    />
                    <CodeTabs
                      samples={requestSamples({
                        method: "PATCH",
                        url: `${api}/links/bulk`,
                        body: {
                          ids: [exampleId, "cm3k9x2ab0003lk08"],
                          action: "addTag",
                          tag: "q4",
                        },
                        name: "result",
                      })}
                    />
                    <CodeBlock
                      label="Response 200"
                      code={json({ action: "addTag", affected: 2 })}
                    />
                  </Endpoint>
                </DocSection>

                {/* --------------------------------------------- analytics */}
                <DocSection id="analytics" title="Analytics" icon={ChartColumn}>
                  <Prose>
                    Click analytics for one link, or for every link on your account. Buckets and the
                    heatmap use the timezone you pass, so a day runs from your midnight to your
                    midnight. The bucket size follows the period: hourly up to two days, daily up to
                    120 days, weekly up to two years, then monthly.
                  </Prose>
                  <Endpoint
                    method="GET"
                    path="/api/v1/links/{id}/stats"
                    summary="Analytics for one link"
                  />
                  <Endpoint
                    method="GET"
                    path="/api/v1/stats"
                    summary="Analytics across your account"
                  >
                    <Prose>
                      Same shape, plus <InlineCode>topLinks</InlineCode>,{" "}
                      <InlineCode>totalLinks</InlineCode> and <InlineCode>activeLinks</InlineCode>.
                    </Prose>
                  </Endpoint>
                  <FieldTable
                    caption="Analytics query parameters"
                    rows={[
                      {
                        name: "period",
                        type: STATS_PERIODS.join(" | "),
                        description: "How far back to look. Defaults to 7d.",
                      },
                      {
                        name: "tz",
                        type: "string",
                        description:
                          "IANA timezone such as Europe/Berlin or America/New_York. Defaults to UTC.",
                      },
                      {
                        name: "includeBots",
                        type: "true | false",
                        description:
                          "Count crawlers and link-preview bots in the breakdowns. Totals always report bots separately.",
                      },
                    ]}
                  />
                  <CodeTabs
                    samples={requestSamples({
                      method: "GET",
                      url: `${api}/links/${exampleId}/stats`,
                      query: { period: "30d", tz: "Europe/Berlin" },
                      name: "stats",
                    })}
                  />
                  <SubHeading>Response fields</SubHeading>
                  <FieldTable
                    nameHeader="Field"
                    caption="Analytics response fields"
                    rows={[
                      {
                        name: "totals",
                        type: "object",
                        description:
                          "clicks, uniques (distinct visitors), bots and qrScans for the period.",
                      },
                      {
                        name: "previous",
                        type: "object | null",
                        description:
                          "clicks and uniques for the period before, for comparisons. Null for all.",
                      },
                      {
                        name: "timeseries",
                        type: "object[]",
                        description:
                          "One entry per bucket: bucket (local time), clicks, uniques and bots.",
                      },
                      {
                        name: "referrers",
                        type: "Breakdown[]",
                        description:
                          "Referring sites by hostname. Direct visits have an empty key.",
                      },
                      {
                        name: "countries",
                        type: "Breakdown[]",
                        description: "ISO 3166-1 alpha-2 country codes, top 50.",
                      },
                      {
                        name: "cities",
                        type: "Breakdown[]",
                        description: "City names, each with its country code.",
                      },
                      {
                        name: "devices",
                        type: "Breakdown[]",
                        description: "desktop, mobile, tablet and so on.",
                      },
                      { name: "browsers", type: "Breakdown[]", description: "Browser names." },
                      { name: "os", type: "Breakdown[]", description: "Operating systems." },
                      {
                        name: "languages",
                        type: "Breakdown[]",
                        description: "Primary browser language, such as en or pt-BR.",
                      },
                      {
                        name: "sources",
                        type: "Breakdown[]",
                        description: "How visitors arrived: link, qr or bio.",
                      },
                      {
                        name: "heatmap",
                        type: "object[]",
                        description:
                          "Clicks by dow (1 is Monday, 7 is Sunday) and hour (0 to 23), in your timezone.",
                      },
                    ]}
                  />
                  <Prose>
                    A <InlineCode>Breakdown</InlineCode> row is{" "}
                    <InlineCode>{"{ key, clicks, uniques }"}</InlineCode>, sorted by clicks and
                    limited to the top 10 unless noted. The response also echoes{" "}
                    <InlineCode>period</InlineCode>, <InlineCode>timezone</InlineCode>,{" "}
                    <InlineCode>granularity</InlineCode> and <InlineCode>range</InlineCode>.
                  </Prose>
                  <CodeBlock
                    label="Response 200 (abridged)"
                    code={json({
                      period: "30d",
                      timezone: "Europe/Berlin",
                      granularity: "day",
                      range: {
                        since: "2026-10-07T09:30:00.000Z",
                        until: "2026-11-06T09:30:00.000Z",
                      },
                      totals: { clicks: 1284, uniques: 932, bots: 57, qrScans: 211 },
                      previous: { clicks: 1010, uniques: 744 },
                      timeseries: [
                        { bucket: "2026-10-07T00:00:00", clicks: 38, uniques: 30, bots: 2 },
                      ],
                      referrers: [{ key: "news.ycombinator.com", clicks: 412, uniques: 377 }],
                      countries: [{ key: "DE", clicks: 301, uniques: 240 }],
                      sources: [
                        { key: "link", clicks: 1073, uniques: 780 },
                        { key: "qr", clicks: 211, uniques: 160 },
                      ],
                      heatmap: [{ dow: 1, hour: 9, clicks: 44 }],
                    })}
                  />
                </DocSection>

                {/* -------------------------------------------------- tags */}
                <DocSection id="tags" title="Tags" icon={Tags}>
                  <Prose>
                    Tags group links in the dashboard and in the API. Pass tag names in a
                    link&apos;s <InlineCode>tags</InlineCode> field and missing tags are created for
                    you, or manage them directly. Filter links with{" "}
                    <InlineCode>{"GET /api/v1/links?tag={id}"}</InlineCode> and tag many links at
                    once with the <InlineCode>addTag</InlineCode> bulk action.
                  </Prose>
                  <Endpoint method="GET" path="/api/v1/tags" summary="List tags">
                    <Prose>All of your tags, alphabetically, each with a linkCount.</Prose>
                  </Endpoint>
                  <Endpoint method="POST" path="/api/v1/tags" summary="Create a tag">
                    <FieldTable
                      caption="Create tag body"
                      rows={[
                        {
                          name: "name",
                          type: "string",
                          required: true,
                          description:
                            "Up to 40 characters, unique on your account (409 otherwise).",
                        },
                        {
                          name: "color",
                          type: "string",
                          description: <>One of {TAG_COLORS.join(", ")}. Defaults to blue.</>,
                        },
                      ]}
                    />
                    <CodeTabs
                      samples={requestSamples({
                        method: "POST",
                        url: `${api}/tags`,
                        body: { name: "newsletter", color: "purple" },
                        name: "tag",
                      })}
                    />
                    <CodeBlock
                      label="Response 201"
                      code={json({
                        id: "cm3k9x2ab0005lk08",
                        name: "newsletter",
                        color: "purple",
                        createdAt: "2026-11-06T09:30:00.000Z",
                        linkCount: 0,
                      })}
                    />
                  </Endpoint>
                </DocSection>

                {/* ------------------------------------------- link object */}
                <DocSection id="link-object" title="Link object" icon={Route}>
                  <Prose>
                    Fields you can send when creating or updating a link. Everything except{" "}
                    <InlineCode>url</InlineCode> is optional, and on update{" "}
                    <InlineCode>null</InlineCode> clears a field.
                  </Prose>
                  <FieldTable
                    nameHeader="Field"
                    caption="Link input fields"
                    rows={linkInputRows(origin)}
                  />
                  <Callout title="Anonymous links">
                    Links created without an API key only use <InlineCode>url</InlineCode>,{" "}
                    <InlineCode>customAlias</InlineCode>, <InlineCode>emoji</InlineCode>,{" "}
                    <InlineCode>password</InlineCode>, <InlineCode>expiresAt</InlineCode> and{" "}
                    <InlineCode>maxClicks</InlineCode>. Other fields are ignored.
                  </Callout>
                  <SubHeading>Read-only fields</SubHeading>
                  <Prose>Responses also include:</Prose>
                  <FieldTable
                    nameHeader="Field"
                    caption="Read-only link fields"
                    rows={READ_ONLY_FIELDS}
                  />
                </DocSection>

                {/* ---------------------------------------------- webhooks */}
                <DocSection id="webhooks" title="Webhooks" icon={Webhook}>
                  <Prose>
                    Webhooks push events to your server as they happen. Add an endpoint under{" "}
                    <strong className="text-foreground font-semibold">
                      Settings &gt; Webhooks
                    </strong>
                    , choose its events and copy its signing secret.
                  </Prose>
                  <FieldTable
                    nameHeader="Event"
                    caption="Webhook events"
                    rows={WEBHOOK_EVENTS.map((event) => ({
                      name: event,
                      type: {
                        "link.created": "{ link }",
                        "link.updated": "{ link }",
                        "link.deleted": "{ link: { id, shortCode, domain } }",
                        "link.clicked": "{ link, click }",
                      }[event],
                      description: {
                        "link.created":
                          "A link was created in the dashboard, through the API or by an import. link is the full link object.",
                        "link.updated":
                          "A link was edited. link is the full link object after the change.",
                        "link.deleted": "A link was deleted.",
                        "link.clicked":
                          "A person (not a bot) opened a link. click has timestamp, source, destination, country, city, device, browser, os, referrer and language.",
                      }[event],
                    }))}
                  />
                  <Prose>
                    Every delivery is a <InlineCode>POST</InlineCode> with a JSON body of the form{" "}
                    <InlineCode>{"{ id, event, createdAt, data }"}</InlineCode>:
                  </Prose>
                  <CodeBlock
                    label="link.clicked payload"
                    code={json({
                      id: "evt_5f2b9c1e8a7d4f3b2c1d0e9f",
                      event: "link.clicked",
                      createdAt: "2026-11-06T09:41:12.512Z",
                      data: {
                        link: { id: exampleId, shortCode: "launch", domain: null },
                        click: {
                          timestamp: "2026-11-06T09:41:12.498Z",
                          source: "qr",
                          destination: exampleLink.originalUrl,
                          country: "DE",
                          city: "Berlin",
                          device: "mobile",
                          browser: "Mobile Safari",
                          os: "iOS",
                          referrer: null,
                          language: "de",
                        },
                      },
                    })}
                  />
                  <FieldTable
                    nameHeader="Header"
                    showType={false}
                    caption="Webhook request headers"
                    rows={[
                      { name: "Content-Type", description: "application/json" },
                      { name: "User-Agent", description: `${config.siteName}-Webhooks/1.0` },
                      {
                        name: "X-Linkly-Event",
                        description: "The event name, for example link.clicked.",
                      },
                      {
                        name: "X-Linkly-Signature",
                        description: (
                          <>
                            <InlineCode>sha256=</InlineCode> followed by the hex HMAC-SHA256 of the
                            raw request body, keyed with your webhook secret.
                          </>
                        ),
                      },
                    ]}
                  />
                  <SubHeading id="verify-signatures">Verify signatures</SubHeading>
                  <Prose>
                    Compute the HMAC over the raw body exactly as received. Parsing and
                    re-serialising the JSON first can change whitespace or key order and break the
                    comparison.
                  </Prose>
                  <CodeBlock label="Node.js" code={verifySnippet} />
                  <SubHeading>Delivery</SubHeading>
                  <List>
                    <li>
                      Respond with any 2xx status within 5 seconds. Slow or failing endpoints are
                      recorded on the webhook in the dashboard.
                    </li>
                    <li>
                      Deliveries are not retried and redirects are not followed, so use your
                      endpoint&apos;s final URL.
                    </li>
                    <li>
                      Each delivery has a unique <InlineCode>id</InlineCode>; use it to ignore
                      duplicates.
                    </li>
                    <li>Bots and link-preview crawlers never trigger link.clicked.</li>
                    <li>
                      <strong className="text-foreground font-semibold">Send test</strong> in the
                      dashboard delivers a <InlineCode>ping</InlineCode> event with a{" "}
                      <InlineCode>{"{ message }"}</InlineCode> payload, signed like any other event.
                    </li>
                  </List>
                </DocSection>

                {/* ------------------------------------------ special urls */}
                <DocSection id="special-urls" title="Special URLs" icon={Signpost}>
                  <Prose>
                    Short links come with a few companion addresses. Replace{" "}
                    <InlineCode>{"{code}"}</InlineCode> with a short code, for example{" "}
                    <InlineCode>{`${host}/launch+`}</InlineCode>.
                  </Prose>
                  <FieldTable
                    nameHeader="URL"
                    showType={false}
                    caption="Special URLs"
                    rows={[
                      {
                        name: "/{code}+",
                        description:
                          "Preview page: where a link goes, whether it still works and a QR code, without redirecting. Visitors can report a link from here.",
                      },
                      {
                        name: "/{code}?qr=1",
                        description:
                          "Added to the URL inside generated QR codes so scans are counted separately from clicks. Internal markers like qr are removed before visitors are forwarded.",
                      },
                      {
                        name: "/@handle",
                        description: "A link-in-bio page with its owner's pinned links.",
                      },
                      {
                        name: "/stats/{code}",
                        description:
                          "Public analytics, for links whose owner turned on publicStats. Add ?domain= for links on a custom domain.",
                      },
                      {
                        name: "/api/qr/{code}",
                        description:
                          "QR code image. Options: size (128 to 2048), fg and bg hex colours, ec (L, M, Q or H), margin, format=svg, domain, download=1, and track=0 to leave out the qr=1 marker.",
                      },
                    ]}
                  />
                </DocSection>

                {/* ------------------------------------------------ errors */}
                <DocSection id="errors" title="Errors" icon={CircleAlert}>
                  <Prose>
                    Errors use conventional HTTP status codes and a JSON body with a readable{" "}
                    <InlineCode>error</InlineCode> message. Validation failures add{" "}
                    <InlineCode>fieldErrors</InlineCode>, keyed by field name.
                  </Prose>
                  <CodeBlock
                    label="Response 400"
                    code={json({
                      error: "Please enter a valid URL",
                      fieldErrors: { url: ["Please enter a valid URL"] },
                    })}
                  />
                  <FieldTable
                    nameHeader="Status"
                    showType={false}
                    caption="HTTP status codes"
                    rows={[
                      {
                        name: "400 Bad Request",
                        description: "The body or query failed validation. Check fieldErrors.",
                      },
                      {
                        name: "401 Unauthorized",
                        description: "The API key is missing, invalid, expired or revoked.",
                      },
                      {
                        name: "403 Forbidden",
                        description:
                          "Not allowed, for example editing a link a moderator blocked, or using a custom domain without signing in.",
                      },
                      {
                        name: "404 Not Found",
                        description: "The resource does not exist or belongs to another account.",
                      },
                      {
                        name: "409 Conflict",
                        description: "The custom alias or tag name is already taken.",
                      },
                      {
                        name: "410 Gone",
                        description:
                          "The link has expired, is paused, is not active yet or reached its click limit (password unlock).",
                      },
                      {
                        name: "429 Too Many Requests",
                        description: "A rate limit was hit. Wait for Retry-After seconds.",
                      },
                      {
                        name: "500 Internal Server Error",
                        description: "Something went wrong on our side. Retry with backoff.",
                      },
                    ]}
                  />
                </DocSection>

                {/* ------------------------------------------------- abuse */}
                <DocSection id="abuse" title="Abuse" icon={ShieldCheck}>
                  <Prose>
                    Short links are a popular way to disguise harmful pages, so links are checked
                    when they are saved, visitors can always see where a link goes before opening
                    it, and anyone can report one.
                  </Prose>
                  <List>
                    <li>
                      Destinations are screened on save. Blocked domains and their subdomains are
                      refused, links to other short links are refused to prevent redirect chains,
                      and when Google Safe Browsing is configured, URLs it flags for malware or
                      phishing are rejected. Operators can also limit an instance to an allowlist of
                      domains.
                    </li>
                    <li>
                      To report a link, add <InlineCode>+</InlineCode> to it to open its preview
                      page and choose{" "}
                      <strong className="text-foreground font-semibold">Report this link</strong>.
                      Moderators review every report.
                    </li>
                    <li>
                      Moderators can block a link or ban an account. A blocked link stops
                      redirecting, shows a notice instead and hides its public stats; every link of
                      a banned account stops working.
                    </li>
                  </List>
                  <Endpoint method="POST" path="/api/reports" summary="Report a link">
                    <Prose>
                      Reports can also be filed programmatically, without an API key. The reason is
                      one of {REPORT_REASONS.join(", ")}; <InlineCode>details</InlineCode> and a
                      contact <InlineCode>email</InlineCode> are optional, and{" "}
                      <InlineCode>domain</InlineCode> is only needed for links on a custom domain.
                    </Prose>
                    <CodeTabs
                      samples={requestSamples({
                        method: "POST",
                        url: `${origin}/api/reports`,
                        body: {
                          code: "launch",
                          reason: "phishing",
                          details: "Asks for bank login details",
                        },
                        auth: false,
                        name: "report",
                      })}
                    />
                  </Endpoint>
                </DocSection>

                {/* ----------------------------------------------- openapi */}
                <DocSection id="openapi" title="OpenAPI" icon={FileJson}>
                  <Prose>
                    A machine-readable OpenAPI 3.1 description of the v1 API is published at{" "}
                    <a
                      href="/api/v1/openapi.json"
                      className={cn(
                        mono,
                        "text-primary text-[0.9em] font-medium break-all hover:underline",
                      )}
                    >
                      {`${api}/openapi.json`}
                    </a>
                    . Import it into Postman, Insomnia or Bruno, browse it with Swagger UI, or
                    generate a typed client from it. It is served with permissive CORS headers, so
                    browser-based tools can load it directly.
                  </Prose>
                  <CodeBlock
                    label="Download"
                    code={`curl -o linkly-openapi.json ${api}/openapi.json`}
                  />
                </DocSection>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
