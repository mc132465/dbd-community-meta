# Update & Patching Guide

How to apply new versions safely. Migrations in this project are **additive and
idempotent**, so updating is normally low-risk — but always back up first.

## Standard update (Docker)

```bash
# 1. Back up (see docs/backup-restore.md)
docker compose exec -T postgres pg_dump -U dbd -d dbd > backup-$(date +%F).sql

# 2. Get the new code
git pull            # or unzip a new release over your working copy

# 3. Rebuild and restart
docker compose up -d --build
docker compose logs -f app
```

On boot the entrypoint runs `db:migrate` (idempotent), so schema changes apply
automatically. Named volumes (`pgdata`, `assets`) are preserved across a rebuild.

## Applying migrations manually

If you run with `BOOTSTRAP_DEMO=false` or outside Docker:

```bash
pnpm db:migrate          # apply the schema (safe to re-run)
# Docker: docker compose exec app node_modules/.bin/tsx scripts/db/migrate.ts
```

The schema lives in `db/schema.sql` as one idempotent batch (`create table if not exists`,
`alter table ... add column if not exists`). Re-running it does not duplicate or drop data.

## Verifying after an update

```bash
pnpm typecheck && pnpm build     # if building from source / contributing
pnpm diagnose:assets             # if the update touched assets/imports
```

Check `CHANGELOG.md` for the version's notes, and `VERSION` for the current version
string. Several recent releases add columns (e.g. asset review metadata,
`perks.noob_explanation`, the `audit_log` table); these are applied by `db:migrate`.

## Rolling back

There is no automated down-migration (migrations are additive). To roll back:

1. `docker compose down` (no `-v`).
2. Restore the pre-update database dump.
3. Check out the previous code/release and `docker compose up -d --build`.

## Notes

- Adding new dependencies requires a rebuild (`--build`) so they're installed in the image.
- If a build fails after pulling, run `pnpm lint && pnpm typecheck && pnpm build` locally to
  surface the error before deploying.
