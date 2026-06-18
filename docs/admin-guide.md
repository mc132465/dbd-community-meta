# Admin Panel Guide

The admin area is at `/admin` and is gated by role (moderator/admin). Sections below match
the actual admin navigation.

## Dashboard — `/admin`
Overview stats and entry points.

## Content & moderation
- **Builds** — `/admin/builds`: manage builds; soft-delete/restore.
- **Review queue** — `/admin/builds/queue`: approve/reject submitted (pending) builds.
- **Revisions** — `/admin/builds/revisions`: review edits to approved builds. Each shows a
  before/after compare; approve applies the change to the live build, reject leaves it.
  A nav badge shows the pending count.
- **Recommendations** — `/admin/recommendations`: curate killer→perk suggestions (synergy
  note, order, visibility). Killer-only by design.
- **Moderation** — `/admin/moderation`: reports queue for discussions/content. A badge
  shows open reports.
- **Tags** — `/admin/tags` and **Perk labels** — `/admin/perk-labels`: manage build tags
  and perk label assignments.

## Users
- **Users** — `/admin/users`: list with role, status, last-active. Actions: Activate /
  Suspend / Ban, and Archive / Restore. Suspended/banned/archived users can't log in and
  are treated as logged out. (Tombstone/anonymize and hard delete are planned — see
  `account-system-proposal.md`.)

## Assets
- **Assets** — `/admin/assets`: CRUD for catalog entities themselves (perks, characters,
  items, add-ons, maps), including the "For Noobs" perk field. Includes an explainer of how
  Assets / Asset Packs / Mapping / Import relate.
- **Asset Packs** — `/admin/assets/packs`: review an imported pack and fix mappings
  (assign an image to an entity, or reset to auto).
- **Mapping** — `/admin/assets/mapping`: read-only coverage overview + filterable list of
  every imported image.
- **Review** — `/admin/assets/review`: the queue of uncertain/unmapped images. Confirm /
  Manual map / Reject / Reset to auto. A badge shows the pending count.
- **Import** — `/admin/import`: upload an icon ZIP and run convert + import; also runs the
  catalog/seed imports. See [asset-import.md](asset-import.md).

## Audit log — `/admin/audit`
Append-only, newest-first record of staff actions (revision approve/reject, asset review
decisions, recommendation changes), with an entity-type filter. Read-only.

## System
- **Backup** — `/admin/backup`: export/preview/apply a JSON backup. See
  [backup-restore.md](backup-restore.md).
- **Theme** — `/admin/theme` and **Settings** — `/admin/settings`: runtime appearance and
  site content/config.
- **Maintenance** — `/admin/maintenance`: maintenance mode.

> Section availability depends on role: moderators see moderation/review tooling; some
> system sections are admin-only. Exact gating is enforced in the admin layout and each
> action's role check.
