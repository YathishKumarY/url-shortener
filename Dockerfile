# syntax=docker/dockerfile:1.7

# Linkly self-hosting image.
#
# Registry policy: npm packages must come from your organisation's registry
# (for example JFrog Artifactory), never hardcoded here. Provide an .npmrc as a
# BuildKit secret and/or set NPM_CONFIG_REGISTRY:
#   docker build --secret id=npmrc,src=$HOME/.npmrc \
#                --build-arg NPM_CONFIG_REGISTRY=https://your-registry/api/npm/npm/ .

ARG NODE_VERSION=22

# ---- deps: full dependency tree (also the base of the migrate image) ----
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ARG NPM_CONFIG_REGISTRY
# Prisma downloads its schema-engine binary from binaries.prisma.sh during
# install. Point this at an internal mirror if that host is blocked.
ARG PRISMA_ENGINES_MIRROR
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY} \
    PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR} \
    HUSKY=0
# The schema is copied first because postinstall runs `prisma generate`.
# Install scripts must run: they also fetch the schema engine for this
# platform (linux-musl), which `prisma db push` in the migrate stage needs.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

# ---- migrate: applies the Prisma schema (prisma db push), then exits ----
FROM deps AS migrate
ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1
# Non-interactive: a change Prisma considers destructive fails here instead of
# applying silently. Review it, then run `prisma db push --accept-data-loss`.
CMD ["npx", "prisma", "db", "push"]

# ---- builder: compile the Next.js standalone bundle ----
FROM node:${NODE_VERSION}-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.ts tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY public ./public
COPY src ./src
# NEXT_PUBLIC_* values are inlined at build time, so the public origin must be
# supplied here, not only at runtime.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal production image ----
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat openssl wget
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/config || exit 1
CMD ["node", "server.js"]
