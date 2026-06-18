# Docker Deployment Guide

How to deploy and operate Fog Archives with Docker Compose. Based on
`docker-compose.yml`, `Dockerfile`, and `scripts/docker-entrypoint.sh`.

## Services

- **postgres** — `postgres:16-alpine`, database `dbd`, user `dbd`, data in the named
  volume `pgdata`. Not published to the host by default.
- **app** — the Next.js app (standalone build) on port `3000`. Volumes:
  - `assets:/app/public/assets` — imported icons persist across rebuilds.
  - `./data/assets:/app/data/assets` — host-shared folder for source/uploaded asset
    packs and converted output.

## First deploy

```bash
cp .env.example .env
# Required: POSTGRES_PASSWORD, SESSION_SECRET (openssl rand -hex 32)
# Recommended: change LOCAL_ADMIN_PASSWORD; set NEXT_PUBLIC_SITE_URL
docker compose up -d --build
docker compose logs -f app      # watch the bootstrap
```

### What happens on first boot

`scripts/docker-entrypoint.sh` runs (idempotent — safe to re-run):

1. `db:migrate` — apply the schema (always; required).
2. If `BOOTSTRAP_DEMO=true` (default): `db:seed` (admin account) → `import:game`
   (maps + patches) → `import:characters` (killers/survivors/perks) → `import:powers`
   → `import:perks` → conditional `import:assets` for any pack under
   `data/assets/packs/<slug>/` → `import:tierlists`.
3. Start the server on `:3000`.

Set `BOOTSTRAP_DEMO=false` to apply only the schema and import manually.

## Environment variables

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | DB password; also interpolated into the app's `DATABASE_URL`. Required. |
| `SESSION_SECRET` | Required by compose. Generate with `openssl rand -hex 32`. |
| `NEXT_PUBLIC_SITE_URL` | Absolute base URL for links/metadata. |
| `SESSION_COOKIE_SECURE` | `true` only behind HTTPS; `false` on plain HTTP. |
| `BOOTSTRAP_DEMO` | `true` seeds/imports demo content on boot; `false` skips it. |
| `LOCAL_ADMIN_USERNAME` / `LOCAL_ADMIN_PASSWORD` | Seed admin credentials (`db:seed`). |
| `DATABASE_URL` | Used for non-Docker local runs; ignored in Compose. |

## HTTPS / reverse proxy

The app serves plain HTTP on 3000. For production, terminate TLS at a reverse proxy
(Caddy, Nginx, Traefik) and forward to the app. Only then set `SESSION_COOKIE_SECURE=true`.
On `http://SERVER_IP:3000` it must remain `false` or login will break.

## Common operations

```bash
# Update to new code (see docs/updating.md for migrations)
git pull && docker compose up -d --build

# Run a one-off script inside the running app container
docker compose exec app node_modules/.bin/tsx scripts/import-assets/index.ts --pack=<slug>

# Open a psql shell
docker compose exec postgres psql -U dbd -d dbd

# Stop / start
docker compose down          # keeps named volumes (pgdata, assets)
docker compose up -d
```

## Data persistence

- Database lives in the `pgdata` volume; imported icons in the `assets` volume — both
  survive `docker compose up -d --build`.
- `docker compose down -v` **deletes** those volumes (all data). Don't use `-v` unless you
  intend to wipe. Back up first (see [backup-restore.md](backup-restore.md)).


## Raspberry Pi (low-memory build)

`next build` compiles in-memory and, with strict type-check + lint enabled, can exhaust
the JavaScript heap on a Pi. When that happens the build crashes **before** writing the
standalone bundle, and the Dockerfile's standalone check then fails with a clear message.

The low-memory build mode disables the in-build type-check/lint **and** raises V8's heap
ceiling (default 4096 MB) so the compile can finish using swap.

One-liner (uses the bundled helper; honors `NODE_BUILD_MEMORY`):

```bash
scripts/pi-build.sh
# or a bigger heap:
NODE_BUILD_MEMORY=6144 scripts/pi-build.sh
```

Equivalent explicit commands:

```bash
docker-compose build --build-arg NEXT_STRICT_BUILD=false app
docker-compose up -d
# still OOM? add swap (below) and/or a larger heap:
docker-compose build --build-arg NEXT_STRICT_BUILD=false --build-arg NODE_BUILD_MEMORY=6144 app
```

These are **build-time only** — the running app and its memory use are unchanged, and
normal/strict builds (`docker-compose up -d --build`) are unaffected.

Low-memory mode also disables webpack's build cache (its serialization is a major source
of OOMs on small hosts), so it both skips type/lint and needs less peak memory.

The build log prints a `[build:mem]` line showing available memory and swap. **If
`SwapTotal` is 0 on a Pi with under ~4 GB RAM, add swap before building** — the 4 GB heap
cannot be backed otherwise:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

### Build on another machine (most reliable for very low-RAM Pis)

If the Pi still can't finish the compile even with swap, build the image elsewhere (an
amd64/arm64 desktop or CI) and load it onto the Pi — no compiling on the Pi at all:

```bash
# on the build host (same CPU arch as the Pi, e.g. arm64):
docker-compose build app
docker save dbd-community:latest | gzip > app.tar.gz
scp app.tar.gz pi:~/

# on the Pi:
gunzip -c app.tar.gz | docker load
docker-compose up -d --no-build
```

Recommended: give the Pi swap if it has under ~4 GB RAM:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

Keep running `pnpm typecheck` / `pnpm lint` on a dev machine (or in CI) so skipping the
in-build checks on the Pi doesn't lose coverage. For very low-RAM Pis, building the image
on a stronger machine and loading it on the Pi is the most reliable path.

## Troubleshooting

### `COPY failed: ... /app/.next/standalone: file does not exist` or "JavaScript heap out of memory"

`next build` crashed (heap OOM) before producing the standalone output. Use the
[Raspberry Pi low-memory build](#raspberry-pi-low-memory-build) mode above. If config
changed recently, force a clean rebuild: `docker-compose build --no-cache app`.
