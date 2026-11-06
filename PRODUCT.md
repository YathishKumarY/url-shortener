# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Public link sharers: creators, marketers and small teams who post links publicly (social posts, link-in-bio pages, newsletters, printed posters and QR codes) and want short links that look like theirs and tell them who clicked. Confirmed by the user on 2026-11-06.

Secondary audiences, inferred from the feature set rather than confirmed: developers who automate links through the API, browser extension and webhooks, and people who self-host their own instance.

## Product Purpose

Linkly turns a long URL into a short link anyone can share, then routes each visit to the right destination and records what happened. Success means a first-time visitor shortens a link in seconds without an account, and an account holder can create, brand, organise and understand their links in one place.

## Positioning

Open source and self-hostable, with the advanced features other shorteners reserve for paid tiers included as first-class features: device, country and A/B routing; password, scheduled, expiring and self-destructing links; custom domains; link-in-bio pages; QR codes with scan tracking; an API with signed webhooks. Source: the user's original request that Linkly "have all the features like in other url shorteners".

## Operating Context

- The home page is a working shortener: anonymous visitors shorten links (optionally with alias, password, expiry or click limit), results stay in their browser and can be claimed into an account after sign-up.
- Signed-in work happens in the dashboard: a links list with search, filters and bulk actions; a link builder; per-link and account analytics; a live click stream; settings for tags, API keys, webhooks, domains and account; an admin area for moderators.
- People who open a short link normally never see Linkly. They see a Linkly page only when the link needs it: password unlock, the `/{code}+` preview, expired, scheduled, paused or blocked notices, `/@handle` bio pages, and opt-in public stats.
- Developers read `/docs` and the OpenAPI spec.
- Deployed on Vercel or self-hosted with Docker on any PostgreSQL.

## Capabilities and Constraints

- Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui on Base UI, lucide icons, Recharts, TanStack Query, Prisma 7.
- Company policy: npm packages come only from the organisation's Artifactory registry; avoid adding dependencies.
- Light and dark themes are both supported and user-selectable.
- Short links must resolve fast; analytics exclude bots; visitor IPs are stored only as salted hashes.
- Terminology in use: link, short link, alias, destination, tag, bio page, preview, click, unique visitor, QR scan.

## Brand Commitments

- Keep the current visual identity. On 2026-11-06 the user tried an Impeccable redesign (an embossed label-tape world), rejected it, and said the original theme is better. Design work on Linkly refines this identity (alignment, margins, spacing, rhythm, consistency); it does not replace it.
- The identity to preserve: the name Linkly with the gradient wordmark, the logo mark (two rotated rounded squares with blue and pink strokes, `src/components/shared/linkly-icon.tsx`), the navy ground with blue `#144ee3` and pink `#eb568e` accents, blue-to-pink gradient headline text, glass rows and panels, pill buttons, the decorative cubes, Inter, dark as the default theme, and the floating light/dark toggle.
- The home page's first action is shortening a link in place, without an account.

## Evidence on Hand

- Real proof: the working shortener on the home page, the open-source codebase, the API docs at `/docs`, the OpenAPI spec at `/api/v1/openapi.json`, the browser extension in `extension/`.
- Absent, and not to be fabricated: testimonials, customer logos, usage or click totals, pricing, uptime or performance figures, press mentions, star counts.

## Product Principles

1. Shorten first, sign up later: the core action always works without an account.
2. Power without a paywall: advanced features are presented as part of the product, never as upsells.
3. Honest numbers: analytics count people, not bots, and never inflate.
4. Visible safety: anyone can check where a link goes before visiting, and abuse is reportable.
5. Privacy by default: no third-party trackers; visitor data stays minimal.
