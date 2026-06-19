# Fog Archives

A self-hosted community platform for **Dead by Daylight** — builds, tier lists,
discussions, and a full perk/character catalog, with a moderation and asset-management
admin panel. Runs entirely on your own server (PostgreSQL + Docker); no third-party
backend services.

> **Unofficial fan project.** Not affiliated with or endorsed by Behaviour Interactive.
> "Dead by Daylight" and all related names, art, and icons are the property of their
> respective owners. You are responsible for the rights to any asset pack you import.

---

## Status

**Current version:** `1.0.0-beta` (feature-complete, public-beta-ready). See
[`CHANGELOG.md`](CHANGELOG.md) and [`PROJECT_HISTORY.md`](PROJECT_HISTORY.md). The schema,
admin tooling, account/email system, and community features are all implemented; final
build/typecheck verification is performed on the deployment host (Raspberry Pi) before
release.

---

## Features

**Community**
- Killer/Survivor builds with a staff **review queue** and an **edit → pending revision**
  workflow (the live build stays public until a moderator approves the change), plus an
  append-only **version history** (creation + approved revisions) on every build.
- A logical **build generator**, **popular/trending** sections, and build search/filtering
  by role, character, perk, item, and add-on.
- **Search autocomplete** across the site; standalone search and detail pages for perks,
  items, and add-ons.
- A community **Meta** page (most-used perks/killers/survivors/items/add-ons), **perk
  synergy** ("frequently paired with"), and an **Activity** feed of recent content.
- User-created **tier lists** with a **Community Meta** view (aggregated placements
  for killers, survivors, perks, and maps), and threaded **discussions** with voting and
  moderation.
- Public/private **profiles** (`/u/<username>`): preset avatars, bio, playstyle tags,
  favorite/most-hated killers and perks, and a user's public content.
- Curated **killer perk recommendations** with one-tap add in the build form.
- **"For Noobs"** plain-English explanations for both **perks and killer powers**,
  alongside the official text (admin-editable, with a bulk CSV importer).

**Accounts**
- Username **or email** sign-in, email verification, **password reset**, account
  **restoration**, and **self-service deletion** with emailed confirmation.
- Account lifecycle: archive → tombstone/anonymize → admin-only hard delete; opt-in
  newsletter/events flags.

**Catalog**
- Killers, survivors, perks, items, add-ons, offerings, maps, and killer powers, each with
  detail pages and (where relevant) chapter/realm filters.

**Admin**
- Users (status: active/suspended/banned, archive/restore/anonymize/hard-delete), content
  moderation, a reports queue, and an append-only **audit log**.
- **Asset pipeline:** upload an icon ZIP → convert/classify → map to catalog entities,
  with a **manifest** import for exact mapping, a confidence-scored **smart classifier**,
  a **review queue** for uncertain matches, coverage **diagnostics**, and a read-only
  mapping overview.
- JSON **backup**/restore, runtime theme/content settings, and maintenance mode.

A feature's presence here reflects code in this repository as of the current version.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Database | PostgreSQL 16 |
| Query builder | Kysely (typed SQL) |
| Auth | Local username + password (argon2id), DB-backed sessions (httpOnly cookie) |
| Storage | Local filesystem (`public/assets`) |
| Packaging | Docker + docker-compose; Next.js `standalone` output |
| Package manager | pnpm |

There is **no Supabase / external auth / cloud storage** — everything is self-hosted.

---

## Project structure

```
.
├─ src/
│  ├─ app/            Next.js App Router (public site, /account, /admin, /api)
│  ├─ components/     UI components (shadcn/ui-based)
│  ├─ lib/            services (data/business logic), db (Kysely), auth, config
│  ├─ types/          shared TypeScript types
│  └─ middleware.ts
├─ db/                schema.sql (single idempotent migration batch)
├─ scripts/          import/seed/convert/diagnose CLI scripts + Docker entrypoint
├─ data/             seed catalog data (characters, perks, maps, tier-lists)
├─ public/           static assets (preset avatars); imported icons live in /assets
├─ docs/             deployment, asset-import, admin, backup, and design guides
├─ docker-compose.yml · Dockerfile · .env.example
└─ README · CHANGELOG · OPEN_TASKS · PROJECT_HISTORY
```

---

## Quick start (Docker — recommended)

Requires Docker + Docker Compose.

```bash
git clone <your-repo-url> fog-archives
cd fog-archives
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and SESSION_SECRET (openssl rand -hex 32),
# and change LOCAL_ADMIN_PASSWORD.
docker compose up -d --build
```

On first boot the app container runs `scripts/docker-entrypoint.sh`, which applies the
schema and (when `BOOTSTRAP_DEMO=true`) seeds an admin account and imports the catalog.
Open <http://localhost:3000>. Full details: [`docs/docker-deployment.md`](docs/docker-deployment.md).

> `SESSION_COOKIE_SECURE` must stay `false` on plain HTTP (e.g. `http://SERVER_IP:3000`);
> set it `true` only behind HTTPS/TLS, or browsers will drop the session cookie and login
> will fail.

## Local development (without Docker)

Requires Node 20, pnpm 9, and a local PostgreSQL.

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL to your local Postgres
pnpm db:migrate               # apply schema (idempotent)
pnpm db:seed                  # create the admin account
pnpm import:characters        # catalog (killers/survivors/perks); see scripts/README.md
pnpm dev                      # http://localhost:3000
```

See [`docs/`](docs/) for the asset-import, admin, backup/restore, and update guides.

---

## Screenshots

> _No screenshots are included in this patch. Screenshots will be added under `docs/screenshots/` in a future update._

| | |
|---|---|
| Home / builds | `docs/screenshots/builds.png` |
| Build detail | `docs/screenshots/build-detail.png` |
| Tier lists | `docs/screenshots/tier-lists.png` |
| Profile | `docs/screenshots/profile.png` |
| Admin · asset review | `docs/screenshots/admin-asset-review.png` |
| Admin · audit log | `docs/screenshots/admin-audit.png` |

---

## Documentation

- [`docs/docker-deployment.md`](docs/docker-deployment.md) — deploy & operate with Docker
- **Assets** — drop a PNG at `public/assets/<category>/<slug>.png` and it appears automatically; the DB image URL is only an optional override. Run `pnpm assets:missing` to see gaps. See [`docs/asset-architecture.md`](docs/asset-architecture.md).
- [`docs/asset-import.md`](docs/asset-import.md) — import icon packs (manifest + review) *(optional, legacy bulk workflow)*
- [`docs/admin-guide.md`](docs/admin-guide.md) — admin panel reference
- [`docs/backup-restore.md`](docs/backup-restore.md) — JSON backup & restore
- [`docs/updating.md`](docs/updating.md) — updates, migrations, patching
- [`docs/asset-architecture.md`](docs/asset-architecture.md) — how the asset system works internally
- [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`SECURITY.md`](SECURITY.md) · [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

---

## Roadmap

The core feature set is complete (see [`CHANGELOG.md`](CHANGELOG.md)). Tracked future
enhancements in [`OPEN_TASKS.md`](OPEN_TASKS.md):

- Per-user activity feeds and pagination on the global activity feed.
- A side-by-side diff view between build versions.
- Optional rate-limiting on account-recovery requests.
- Expanded maps data and map-specific tooling.

---

## License

**No license is currently set** — by default this means "all rights reserved," which is
not suitable for an open public project. The maintainer should choose one (e.g. MIT for
permissive, or AGPL-3.0 for copyleft) and add a `LICENSE` file plus a `license` field in
`package.json`. Note that imported game assets are **not** covered by the project's code
license and remain the property of their owners.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). All contributors are expected to follow the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Report security issues per [`SECURITY.md`](SECURITY.md).
