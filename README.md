# Linkly - URL Shortener

Short links with superpowers. Linkly is a full-featured, open-source, self-hostable URL shortener built with Next.js 16: passwords, self-destructing links, device and geo targeting, A/B tests, branded QR codes, custom domains, link-in-bio pages, a REST API with webhooks, and real-time analytics.

It brings together the best ideas from Dub, Bitly, Shlink, Kutt, spoo.me, TinyURL, T.LY, Thinfi, anon.to and friends.

## Features

### Links

- **Custom aliases** up to 50 characters, in any script, including **emoji** (`/🦊🍕🚀`), with live availability checks
- **Random or emoji codes**, configurable length (`SHORT_CODE_LENGTH`)
- **Password protection** (visitors unlock with a password; preview bots never see the destination)
- **Expiration dates** and **click limits** (one-time / self-destructing links), each with an optional **fallback URL**
- **Scheduled links** that go live at a set time, with a countdown page for early visitors
- **Pause / resume** and **archive** without deleting
- **Titles, private notes and colour-coded tags**, with automatic page-title fetching
- **UTM builder** with presets, editing the destination URL in place
- **Duplicate**, **bulk create** (paste up to 100 URLs), **CSV import** (Bitly / Dub / Short.io / Linkly exports) and **CSV/JSON export**
- **Bulk actions**: tag, untag, pause, resume, archive, delete
- **No account needed**: anyone can shorten links (with password, expiry and click limits), then **claim** them into an account after signing up

### Smart routing

- **Device targeting**: separate iOS and Android destinations (app stores, deep links)
- **Geo targeting**: a destination per country
- **A/B testing**: up to five weighted destinations, sticky per visitor, compared in analytics
- **Query forwarding**: `?ref=x` on the short link is passed to the destination (without re-encoding its existing query)
- **Referrer hiding** (anonymous redirects, like anon.to) via `Referrer-Policy: no-referrer`
- **Link cloaking**: keep the short URL in the address bar
- **Private links** (like nolog.link): count clicks without storing anything about visitors
- **Redirect type**: 301, 302, 307 or 308
- **Custom social previews**: your own Open Graph title, description and image for Slack, X, WhatsApp, LinkedIn...

### Analytics

- Clicks and **unique visitors** with period-over-period change, in the viewer's **timezone**
- Hourly/daily/weekly/monthly timelines (gap-filled), **day x hour heatmap**
- Referrers (by site), channels (link / **QR scan** / bio page), countries with flags, cities, languages, devices, browsers, OS
- **A/B and targeting split** per destination
- **Bot detection**: crawlers are recorded separately and never inflate clicks or consume click-limited links
- **Live click stream** over Server-Sent Events
- **Public stats pages** (opt-in per link) and raw click export (CSV/JSON)
- Account-wide dashboard with top links

### Sharing

- **QR codes** with colours, presets, error-correction level, quiet zone, size and a **centre logo** (rendered in the browser), PNG/SVG download, scan tracking
- **Preview pages**: add `+` to any short link to see where it goes before visiting
- **Link-in-bio pages** at `/@handle` with six themes, socials and featured links
- **Custom domains** verified by DNS TXT record, with root and not-found redirects

### Developers

- **REST API** (`/api/v1`) with personal **API keys**, an **OpenAPI 3.1 spec** and interactive docs at `/docs`
- **One-line shorten endpoint** that returns plain text: `curl "$HOST/api/v1/shorten?url=https://example.com&format=simple"`
- **Signed webhooks** (`link.created`, `link.updated`, `link.deleted`, `link.clicked`) with test pings
- **Browser extension** (Chrome, Edge, Firefox), **bookmarklet**, **ShareX** config and an installable **PWA** with an OS share target

### Safety, moderation and privacy

- Only `http(s)` destinations; links to the instance's own short links are refused (no redirect loops)
- **Domain blocklist**, optional **destination allowlist** (`ALLOWED_DOMAINS`, like the Wikimedia shortener) and optional **Google Safe Browsing**
- **Abuse reports** from preview pages, reviewed in the **admin panel** (users, links, reports, blocklist, bans)
- SSRF-guarded server-side fetching for metadata and webhooks
- Rate limits on every write, redirect and sign-in path
- Salted IP hashes, no third-party trackers, geolocation lookups off by default
- Invite-only mode (`DISABLE_REGISTRATION`) and account-only links (`DISABLE_ANONYMOUS_LINKS`)
- Sign in with email, Google, GitHub or any **OpenID Connect** provider (Okta, Entra ID, Keycloak...)

### Self-hosting

- Runs on **any PostgreSQL** (Neon's serverless driver is used automatically for Neon hosts)
- **Redis is optional**: without Upstash the cache and rate limiters use memory
- **Docker** image and Compose file: see [docs/self-hosting.md](docs/self-hosting.md)

## Special URLs

| URL             | What it does                                                   |
| --------------- | -------------------------------------------------------------- |
| `/{code}`       | Redirects (respecting every rule above)                        |
| `/{code}+`      | Preview page: destination, safety info, QR code, report button |
| `/{code}?qr=1`  | Added by QR codes so scans are counted separately              |
| `/@{handle}`    | Link-in-bio page                                               |
| `/stats/{code}` | Public analytics, when the owner enables them                  |
| `/docs`         | API documentation; spec at `/api/v1/openapi.json`              |

## Tech stack

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Prisma 7 with driver adapters (Neon or node-postgres), PostgreSQL, Upstash Redis (optional), NextAuth v5, Tailwind CSS 4, shadcn/ui on Base UI, TanStack Query, Recharts, Zod 4, Vitest.

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (local, Docker or hosted, e.g. [Prisma Postgres](https://www.prisma.io/postgres) or [Neon](https://neon.tech/))

### Setup

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add your email to `ADMIN_EMAILS` to get the admin panel.

### Upgrading an existing database

This release adds columns and tables. All changes are additive, but `prisma db push` asks for confirmation because it adds a unique constraint on `(domain, shortCode)`. Existing links get `domain = ""` and short codes were already unique, so the constraint cannot fail. Back up first (on Neon, create a branch), then:

```bash
npx prisma db push            # review the warning
npx prisma db push --accept-data-loss
```

Email/password accounts now have to verify their address before they can sign in. Accounts created before this change were never asked to, so mark them verified once, or their owners are locked out:

```bash
echo 'UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;' | npx prisma db execute --stdin
```

### Hosting the database on Prisma Postgres (free tier, works with Vercel)

Prisma Postgres is managed PostgreSQL with a built-in connection pooler. Each database has a pooled connection string (`pooled.db.prisma.io`) and a direct one (`db.prisma.io`). Vercel functions scale out and every instance opens its own connections, so the app must use the pooled string; the Free plan allows 10 direct connections.

1. Create a database at [console.prisma.io](https://console.prisma.io/) in the region closest to your Vercel functions (Vercel's default is Washington, D.C., `iad1`, so pick US East).
2. In `.env.local`, set `DATABASE_URL` to the pooled string and `DIRECT_URL` to the direct one.
3. Create the tables: `npx prisma db push` (it connects through `DIRECT_URL`).
4. Moving from another database: copy the data over the direct string, for example `pg_dump --data-only --no-owner "$OLD_DATABASE_URL" | psql "$DIRECT_URL"`.
5. In Vercel, Settings, Environment Variables, set the same `DATABASE_URL` and `DIRECT_URL`, then redeploy.

Vercel's Prisma Postgres integration (Storage tab) also works: it sets `DATABASE_URL` to the direct string and adds `DATABASE_URL_POOLED`, which Linkly picks up automatically. Each Vercel instance keeps 2 connections unless `DATABASE_POOL_SIZE` says otherwise.

## Configuration

Every option is documented in [.env.example](.env.example). The essentials:

| Variable                                          | Purpose                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                    | PostgreSQL connection string (required)                                              |
| `DATABASE_URL_POOLED` / `DIRECT_URL`              | Pooled string for the app, direct string for `prisma db push` (see below)            |
| `AUTH_SECRET`, `AUTH_URL`                         | NextAuth (required)                                                                  |
| `NEXT_PUBLIC_APP_URL`                             | Public origin used in short URLs and QR codes (required)                             |
| `IP_HASH_SALT`                                    | Secret salt for visitor IP hashes (strongly recommended)                             |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`               | Shared cache and rate limits across instances (optional)                             |
| `SMTP_HOST`, `_PORT`, `_USER`, `_PASSWORD`        | Sends verification and reset emails; a Gmail app password works (see `.env.example`) |
| `RESEND_API_KEY`, `EMAIL_FROM`                    | Alternative sender (needs your own domain); sender address                           |
| `AUTH_GOOGLE_*`, `AUTH_GITHUB_*`                  | OAuth sign-in (optional; buttons appear only when set)                               |
| `AUTH_OIDC_ISSUER`, `_ID`, `_SECRET`, `_NAME`     | Single sign-on with any OpenID Connect provider                                      |
| `ADMIN_EMAILS`                                    | Accounts promoted to admin                                                           |
| `DISABLE_REGISTRATION`, `DISABLE_ANONYMOUS_LINKS` | Private / invite-only instances                                                      |
| `ALLOWED_DOMAINS`                                 | Restrict destinations to these domains                                               |
| `GOOGLE_SAFE_BROWSING_API_KEY`                    | Screen destinations for malware and phishing                                         |
| `GEOLOCATION_PROVIDER`                            | IP geolocation when your host sends no country header (`none` by default)            |

## Scripts

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the development server     |
| `npm run build`     | Generate Prisma client and build |
| `npm run start`     | Start the production server      |
| `npm run lint`      | Run ESLint                       |
| `npm run test`      | Run the Vitest suite             |
| `npm run db:push`   | Push the Prisma schema           |
| `npm run db:studio` | Open Prisma Studio               |

## Project structure

```
src/
  app/
    [shortCode]/route.ts   redirect handler (targeting, limits, previews, cloaking)
    api/                   REST API (links, stats, tags, keys, webhooks, domains, bio, admin, v1)
    dashboard/             links, link builder, analytics, live stream, bio editor, settings
    admin/                 moderation panel
    preview/ unlock/ stats/ bio/ docs/ link-*/   public pages
  components/              UI (analytics, links, dashboard, settings, admin, bio, landing...)
  lib/                     redirect engine, stats SQL, safety, webhooks, auth, cache, rate limits
  proxy.ts                 /@handle and /{code}+ rewrites, auth gating
extension/                 browser extension (Manifest V3)
prisma/schema.prisma       data model
```

## Deployment

- **Vercel**: set the environment variables and deploy. Country and city come from Vercel's headers.
- **Docker / any server**: see [docs/self-hosting.md](docs/self-hosting.md).

## License

MIT
