# Self-hosting Linkly with Docker

This runs Linkly with Postgres on one machine using Docker Compose. Redis is optional: without it the app uses an in-memory cache and rate limiter, which is fine for a single instance.

## Prerequisites

- Docker Engine 24+ with the Compose plugin and BuildKit (default in current Docker).
- A domain pointing at the server if you want HTTPS and custom domains.
- Access to your organisation's npm registry (see "Package registry" below).

## 1. Configure

```
cp .env.docker.example .env.docker
```

Edit `.env.docker`:

- `AUTH_SECRET` (`openssl rand -base64 32`) and `IP_HASH_SALT` (`openssl rand -hex 32`).
- `NEXT_PUBLIC_APP_URL` and `AUTH_URL`: the public origin, for example `https://links.example.com`.
- `POSTGRES_PASSWORD`: change it before the first start. The database volume keeps the original password.

`NEXT_PUBLIC_APP_URL` is inlined into the client bundle at build time. Compose reads build args from your shell or a root `.env` file, not from `.env.docker`, so also export it:

```
export NEXT_PUBLIC_APP_URL=https://links.example.com
```

Likewise `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` are read by Compose from the shell or root `.env`; keep them equal to the values in `.env.docker`.

## 2. Package registry (company policy)

The Dockerfile does not hardcode a registry. Point npm at your organisation's registry (for example JFrog Artifactory) in one or both of these ways.

Build secret with an `.npmrc` (credentials never land in an image layer). The compose file declares a `npmrc` secret read from `~/.npmrc` by default; override with `NPMRC_FILE=/path/to/.npmrc`:

```
docker compose up -d --build
```

The relevant stanza in `docker-compose.yml` is:

```yaml
secrets:
  npmrc:
    file: ${NPMRC_FILE:-${HOME}/.npmrc}

services:
  app:
    build:
      context: .
      secrets:
        - npmrc
```

Or build with an explicit secret and an optional registry URL:

```
docker compose build --secret id=npmrc,src=$HOME/.npmrc
NPM_CONFIG_REGISTRY=https://your-registry.example.com/api/npm/npm/ docker compose build
```

Plain `docker build` works too:

```
docker build --secret id=npmrc,src=$HOME/.npmrc \
  --build-arg NPM_CONFIG_REGISTRY=https://your-registry.example.com/api/npm/npm/ \
  --build-arg NEXT_PUBLIC_APP_URL=https://links.example.com .
```

## 3. Start

```
docker compose up -d --build
```

What happens:

1. `db` starts Postgres 17 with a named volume and waits until it is healthy.
2. `migrate` runs `prisma db push` once and exits. It is built from the full dependency stage because the Prisma CLI and schema engine are not part of the slim standalone bundle. The app only starts after it succeeds.
3. `app` serves on port 3000 (health check: `/api/config`).

Open `http://localhost:3000` (or your domain), sign up, and create links. Add `ADMIN_EMAILS` to get the admin area.

## Custom domains

1. Point a CNAME for the domain (for example `go.example.com`) at your server's hostname, and make your reverse proxy forward that host to the app.
2. In the app, open Settings > Domains and add the domain.
3. Add the TXT record shown there to your DNS, then click verify.

## Reverse proxy

Terminate TLS in a proxy (Caddy, nginx, Traefik) and forward all hosts to port 3000. Make sure the proxy sets `X-Forwarded-For` and `X-Forwarded-Proto`.

- `AUTH_TRUST_HOST=true` is required so Auth.js accepts the forwarded host (Compose sets it for you).
- `TRUSTED_PROXY_COUNT` is the number of proxies between the client and the app (default 1). It decides which `X-Forwarded-For` entry is treated as the client IP for rate limiting and analytics; if it is wrong, clients can spoof their IP or everyone shares one address. Use 2 when a CDN sits in front of your proxy.
- `AUTH_URL` and `NEXT_PUBLIC_APP_URL` must match the public origin exactly.

If you do not publish port 3000 publicly, change the mapping to `"127.0.0.1:3000:3000"`.

## Backups

```
docker compose exec -T db pg_dump -U linkly -d linkly -Fc > linkly-$(date +%F).dump
```

Restore into an empty database:

```
docker compose exec -T db pg_restore -U linkly -d linkly --clean --if-exists < linkly-2026-01-01.dump
```

Use the values of `POSTGRES_USER` and `POSTGRES_DB` if you changed them. Also back up `.env.docker`, in particular `AUTH_SECRET`.

## Upgrading

```
git pull
docker compose up -d --build
```

The `migrate` service re-runs `prisma db push` on every `up`. It refuses changes that would lose data; take a backup first and review the output of `docker compose logs migrate` after upgrading.

## Troubleshooting

- Wrong short URLs (still `localhost`): `NEXT_PUBLIC_APP_URL` was not exported at build time. Export it and run `docker compose build --no-cache app`.
- `npm ci` fails with 401 or 404 during build: your `.npmrc` secret is missing or does not cover the registry.
- `npm ci` fails downloading Prisma engines: the install fetches the schema engine from `binaries.prisma.sh`. If that host is blocked, pass `--build-arg PRISMA_ENGINES_MIRROR=https://your-mirror/prisma` (and add `PRISMA_ENGINES_MIRROR` under the `args:` of the `migrate` and `app` builds in `docker-compose.yml`).
- `migrate` exits with a data-loss warning after an upgrade: Prisma refuses changes it considers destructive. Back up, read the warning, then apply it once with `docker compose run --rm migrate npx prisma db push --accept-data-loss`. (Upgrading from the original Linkly schema triggers this for the new `(domain, shortCode)` unique constraint, which is safe because short codes were already unique.)
- App restarts immediately: check `docker compose logs app`, usually a missing `AUTH_SECRET` or `DATABASE_URL`.
