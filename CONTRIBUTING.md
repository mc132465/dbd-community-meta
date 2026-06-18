# Contributing to Fog Archives

Thanks for your interest in improving the project. This guide reflects how the codebase
is actually organized.

## Development setup

- Node 20, pnpm 9, PostgreSQL (16 recommended).
- `pnpm install`, then `cp .env.example .env` and set `DATABASE_URL`.
- `pnpm db:migrate` (idempotent schema), `pnpm db:seed` (admin account), `pnpm dev`.

## Before opening a pull request

Run the same checks CI runs (`.github/workflows/ci.yml`):

```bash
pnpm lint
pnpm typecheck
pnpm build
```

All three must pass. The build is ESLint-strict (no unused vars, no `any`, no
`<img>` without the per-line disable used by the asset components).

## Project conventions

- **Layering:** `*.service.ts` holds data/business logic; reads are marked
  `server-only`. UI mutations go through thin `"use server"` actions that call a service
  and `revalidatePath`. Client components import only actions and `type`-only symbols
  from server modules.
- **Database:** row types live in `src/types/database.ts`; the Kysely `DB` interface and
  table types in `src/lib/db/types.ts`. `jsonb` columns are typed as the parsed JS shape,
  written via `sql\`${JSON.stringify(x)}::jsonb\`` and read back as objects.
- **Migrations are additive and idempotent.** Use `create table if not exists` and
  `alter table ... add column if not exists`; never write destructive changes. Schema
  changes are reviewed deliberately.
- **Auth/roles:** `getCurrentProfile()`, `isModerator(role)`, `isAdmin(role)` in
  `src/lib/auth`. Admin routes are gated by the admin layout.
- **Naming:** service files are `kebab-case.service.ts`; React components are
  `kebab-case.tsx`. Match the surrounding file's style.

## Commit / PR etiquette

- Keep PRs focused; describe what changed and why.
- Update `CHANGELOG.md` (Added/Changed/Fixed/Removed) and, for schema changes, mention
  the migration in the PR description.
- Don't commit secrets or real `.env` files (see `SECURITY.md`). `.env` is gitignored;
  only `.env.example` (placeholders) is tracked.
- Don't commit copyrighted game assets you don't have the right to distribute.

## Reporting bugs / requesting features

Open an issue with reproduction steps (bugs) or a clear use case (features). Check
`OPEN_TASKS.md` first — it may already be planned.
