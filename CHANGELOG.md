# Changelog

All notable changes to this project, summarized by version. This project follows a
pre-1.0 `MAJOR.MINOR.PATCH-dev` scheme during initial development.

## Unreleased — Repository preparation
### Security
- Scrubbed a concrete `SESSION_SECRET` value and the default admin password from the
  committed `.env.example` (now placeholders). `.env` remains gitignored.
### Changed
- CI workflow: removed stale Supabase build env (project is plain PostgreSQL / Path B);
  replaced with `SESSION_SECRET` / `DATABASE_URL` / `NEXT_PUBLIC_SITE_URL` placeholders.
- package.json version bumped 0.1.0 → 1.8.0-dev to match VERSION.
### Added (docs)
- Overhauled README.md; added CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md.
- New docs/: docker-deployment, asset-import, admin-guide, backup-restore, updating,
  plus a screenshots placeholder.

## 1.4.0-beta — 2026-06-16 (Convention-based assets)
### Changed
- **Assets are now convention-based.** An image at `public/assets/<category>/<slug>.png`
  appears automatically — no packs, mapping, review, or import step needed. The DB
  `icon_url`/`image_url` is only an optional override. The default is applied at the catalog
  read layer (`assets.service`), so every surface that renders a catalog image benefits.
- `AssetThumb` is now resilient: it resolves override-then-convention and degrades to a clean
  initials placeholder when a file is missing or fails to load (onError), instead of a broken
  image. Categories: perks, killers, survivors, items, addons, maps, offerings, powers.
### Added
- `pnpm assets:missing` — per-category report of catalog slugs with no file on disk.
- `public/assets/<category>/` folders (with drop-in hints) for all eight categories.
### Notes
- The pack/mapping/review/import workflow still exists but is now **optional** bulk tooling;
  `docs/asset-architecture.md` and the README were updated to make the convention primary.

## 1.3.0-beta — 2026-06-16 (Account consolidation · profile trim)
### Changed
- **Account is now the single source of truth** (/account): role + account status display,
  username management, email (address / change / verification / newsletter+events prefs),
  and account deletion all on one page. The standalone Email and Delete pages now redirect
  to /account; the email-nag and verify links point there too.
### Removed
- **Favorite / Most-Hated Killer & Survivor *perks*** removed from public profiles and the
  profile editor — public display, edit UI, and the underlying pick handling. Favorite /
  Most-Hated *Killers* are kept. `profile_picks` is retained (still used for killer picks).

## 1.2.0-beta — 2026-06-16 (Community Meta rename · moderation · permanent delete · admin nav)
### Added
- **Content moderation** (Admin → Content → Content moderation): one place to view builds,
  comments, tier lists, and discussions, with search, Open, Archive/Restore, and admin-only
  **permanent delete** (typed DELETE confirmation, audit-logged, cascades all related data).
  Removing a build/thread/tier-list also clears it from the activity feed (which is derived
  from these tables), so development junk can be removed for good.
### Changed
- Renamed **Consensus → Community Meta** everywhere — heading, tier-lists link, descriptions,
  and the URL (`/tier-lists/community-meta`). Framed as the community's living meta snapshot
  (aggregated tier lists, ratings, and placements) rather than a calculation.
- **Admin navigation** regrouped into collapsible Content / Catalog / Community / System
  dropdowns (previously one overcrowded bar), with pending-count badges on the groups.

## 1.1.0-beta — 2026-06-16 (Navigation, characters & search cleanup)
### Changed
- Header nav trimmed to five core sections (Characters, Perks, Builds, Tier Lists,
  Discussions). Items, Add-ons, Maps, Meta, Activity, and Guides removed from the nav
  (their pages still exist and are reachable directly / from related pages).
- Restored the previous Survivor badge color (Killer styling unchanged).
- Search/autocomplete now ranks prefix matches strongly above substring matches, ranked
  globally across characters/perks/builds (e.g. “the n” → The Nemesis/Nightmare/Nurse
  first). Applied to global search, the typeahead, and perk free-text search.
### Removed
- Character detail “Statistics” placeholder section.
- Character list “Chapter” filter and its logic (Realm filter retained).

## 1.0.3-beta — 2026-06-16 (Smaller low-memory build footprint)
### Fixed
- `next build` still OOMing on very low-memory hosts even in low-memory mode. Low-memory
  mode now also **disables webpack's build cache** (its serialization is a primary OOM
  source) and sets `productionBrowserSourceMaps:false`, cutting peak heap so the compile
  fits. Default/strict builds keep the cache and are unchanged.
### Added
- The build log prints a `[build:mem]` line (RAM + swap) so it's obvious whether swap is
  present. The failure message now references `scripts/pi-build.sh`, the swap commands,
  and a `docker save`/`docker load` build-on-another-machine fallback.
- Deployment guide: swap-required note, the build-elsewhere path, and the diagnostic line.

## 1.0.2-beta — 2026-06-16 (Raspberry Pi low-memory build path)
### Fixed
- `next build` crashing with a JavaScript heap OOM on low-memory hosts (the compile
  itself, not only type/lint), which left no standalone output. Low-memory mode now
  raises V8's heap ceiling (auto 4096 MB, override via `NODE_BUILD_MEMORY`) in addition
  to skipping the in-build type-check/lint.
### Added
- `NODE_BUILD_MEMORY` build arg (Dockerfile + docker-compose) and `scripts/pi-build.sh`
  helper that runs the low-memory build via `docker-compose` and starts the stack.
- Deployment guide: a “Raspberry Pi (low-memory build)” section (swap setup + exact
  `docker-compose --build-arg` commands).
### Notes
- Default/strict builds are unchanged. The standalone assertion now states the OOM cause
  and the exact retry commands. No new dependencies; no schema change.

## 1.0.1-beta — 2026-06-16 (Docker build fix for low-memory hosts)
### Fixed
- Docker build failing with `COPY ... /app/.next/standalone: file does not exist`. On
  memory-constrained hosts (e.g. Raspberry Pi) the in-build type-check/lint could be
  OOM-killed, leaving no standalone output. The strict in-build checks are now opt-out
  via `NEXT_STRICT_BUILD=false` (default stays strict), and the builder asserts the
  standalone output exists, failing with a clear message instead of an opaque COPY error.
### Changed
- `docker-compose.yml` exposes the `NEXT_STRICT_BUILD` build arg; `.env.example` and
  `docs/docker-deployment.md` document the low-memory build path.

## 1.0.0-beta — 2026-06-16 (Feature-complete · public beta)
Marks the feature-complete milestone. The account/email system, search & discovery,
visual polish, community meta, perk synergy, tier-list consensus, “For Noobs” for perks
and powers (with bulk import), build version history, item/add-on detail pages, and the
activity feed are all implemented. Final build/typecheck/test runs on the deployment host.
### Added
- Tier-list **consensus for maps** — the consensus view now spans killers, survivors,
  killer/survivor perks, and maps.
### Housekeeping
- README refreshed to the full feature set; final cleanup pass (no TODO/placeholder/
  debug cruft; no secrets in `.env.example`).

## 1.17.0-dev — 2026-06-16 (Activity feed + item/add-on navigation)
### Added
- Community **Activity** feed (/activity): a unified, read-only stream of the newest
  approved builds, published tier lists, and discussion threads, with type badges.
  Added to the main nav. No schema — merges existing tables by timestamp.
### Changed
- Add-on list entries and the Meta page’s item/add-on rankings now link through to their
  detail pages, completing item/add-on navigation.
### Notes
- Build version history is confirmed complete: the initial ‘created’ entry is recorded on
  first approval and ‘revision’ entries on approved revisions. No staff path edits build
  content outside the revision flow, so the ‘staff_edit’ kind stays reserved by design.

## 1.16.0-dev — 2026-06-16 (Tier-list consensus + bulk For Noobs import)
### Added
- Tier-list **consensus** page (/tier-lists/consensus): aggregates every published tier
  list into community consensus placements for killers, survivors, and killer/survivor
  perks, ranked by average tier (with how many lists placed each). Linked from the
  tier-lists index. No schema — derived from tier_list_entries.
- `pnpm import:noob`: bulk-import “For Noobs” explanations (and optional official
  descriptions) for perks and powers from a CSV (kind,slug,noob_explanation[,description]),
  matched by slug — lets every explanation be populated at once.

## 1.15.0-dev — 2026-06-16 (For Noobs: killer powers)
### Added
- “For Noobs” now covers killer powers, not just perks. Killer pages show the power’s
  Official Description followed by a plain-English “For Noobs:” section, matching perks.
- Admin can edit a power’s For Noobs explanation (Assets → Powers).
### Schema
- `powers.noob_explanation` (additive).
### Notes
- The For Noobs *feature* is now complete for both perks and powers. The explanation
  *text* is authored per perk/power in the admin editor (not auto-generated).

## 1.14.0-dev — 2026-06-16 (Build version history)
### Added
- Append-only build version history: each approved revision now records a version entry
  (version number, kind, author, note, content snapshot). Build pages show a “Revision
  history” timeline.
### Schema
- New `build_versions` table (build_id, version_no, kind, content jsonb, author_id, note).
### Follow-up
- Also record initial build creation and direct staff edits as version entries.

## 1.13.0-dev — 2026-06-16 (Perk synergy / related perks)
### Added
- Perk pages now show a “Frequently paired with” section — the perks most often used
  alongside this one, computed from co-occurrence in approved community builds (with a
  pairing count). No schema; derived from build_perks.

## 1.12.0-dev — 2026-06-16 (Email-backed auth flows — Phase B.2)
### Added
- Sign in with username **or** email + password.
- Password reset: request a link at /forgot, set a new password at /reset (1-hour token);
  resetting clears existing sessions.
- Account restoration: archived (non-anonymized) users can request a restore link at
  /restore and reactivate their account.
- Self-service deletion: from Account → Delete, request an emailed confirmation link;
  confirming at /confirm-delete archives the account and signs out (a moderator finalizes
  removal; the account can be restored from email beforehand).
- 'Forgot password?' link on login; restore + delete links added to the relevant pages.
### Notes
- No new schema (uses the `email_tokens` purposes provisioned in 1.10.0) and no new deps.

## 1.11.0-dev — 2026-06-16 (Search, visual polish & community meta)
### Added
- Navbar search autocomplete: debounced typeahead dropdown of matching characters,
  perks, and builds; Enter still runs the full /search.
- Free-text search box on /perks (combines with the existing label filters).
- Standalone /items and /add-ons search pages (with no-results states) + nav links.
- /meta community stats page: most-used perks, killers, survivors, items, and add-ons
  across approved community builds + nav link.
### Changed
- Survivor role badge now uses a blue accent (distinct from killer red), including on
  survivor-perk badges.
- /characters gained chapter and realm filters (preserving the role tab + sort).

## 1.10.0-dev — 2026-06-16 (Email System Foundation — Phase B)
### Added
- New accounts require a unique email, captured at signup and confirmed via a hashed,
  single-use verification link (3-day expiry). Verification page at /verify.
- SMTP email transport (nodemailer) configured by env, with a console/log fallback when
  SMTP is unset so flows work in development. New `lib/email/{mailer,tokens,send}`.
- Soft email nag banner for signed-in users without a verified email (never blocks).
- Account → Email page: set/change email, resend verification, and opt in to newsletter /
  event reminders (both off by default; apply once verified).
### Schema
- `users.email` + `users.email_verified_at` (+ unique index on lower(email) where set);
  `profiles.email_opt_newsletter` / `email_opt_events` (default false); new `email_tokens`
  table (verify / password_reset / delete_confirm / restore).
### Dependencies
- Added `nodemailer` (+ `@types/nodemailer`). Run `pnpm install` before building.
### Deferred (Phase B.2)
- Email-or-username login, password reset, self-service deletion confirmation, and
  account restoration — token purposes already provisioned.

## 1.9.0-dev — 2026-06-16 (Account deletion: tombstone + hard delete)
### Added
- Two permanent-deletion modes, both reachable only from the archived state:
  - **Tombstone / anonymize (default, safe):** keeps the row + all authored content,
    blanks PII, renames username to `deleted_<id8>` (freeing the original), marks
    `anonymized_at`; content shows as “[deleted]”. `tombstoneUser()`.
  - **Hard delete (admin-only, destructive):** `DELETE`s the user row → cascades to
    profile, sessions, and all content. Requires a typed-username confirmation; audit
    entry written before deletion. `hardDeleteUser(userId, confirmUsername)`.
- Admin → Users: archived rows now show Restore · Tombstone · Hard delete; hard delete
  uses an inline typed-confirmation (new client component). Anonymized rows show a
  “Deleted” badge. All three transitions are recorded in the audit log
  (`user.anonymize`, `user.hard_delete`).
### Changed / Schema
- Added `users.anonymized_at` (+ index). Reuses existing `deleted_at` (archived) and
  `status` (moderation) — no conflicting status enum introduced.
- Username cooldown trigger now exempts the reserved `deleted_` system rename, so a
  tombstone never fails on a recent username change. Signup rejects the `deleted_` prefix.

## 1.8.0-dev — 2026-06-16 (Audit log / review history)
### Added
- Append-only `audit_log` table (actor, action, entity_type, entity_id, metadata jsonb,
  created_at) with indexes. New `audit.service.ts` (`recordAudit`, `listAuditLog`,
  `listAuditEntityTypes`); recordAudit resolves the actor from the session and never
  throws (best-effort, can't break the underlying action).
- Audit entries now recorded for: build revision approve/reject, asset review
  confirm/reject/manual-map/reset, and recommendation add/delete.
- Admin → Audit log (/admin/audit): read-only, most-recent-first table with an
  entity-type filter (when, actor, action, entity, details). Nav link added.

## 1.7.0-dev — 2026-06-16 (Asset review queue + smart classifier)
### Added
- Admin → Review (/admin/assets/review): queue of uncertain/unmapped images with
  preview, detected category, filename, suggested match, and confidence. Per-image
  actions: Confirm (use suggested match), Manual map (pick a catalog target + Assign),
  Reject (don't use), Reset to auto. Plain-language help explains each. Nav badge shows
  the pending count. New `asset-review.service.ts`.
- Smart fallback classifier in import-assets: exact stored slug → confidence 1.0,
  unique name-derived slug → 0.9 (both auto-confirmed); a single fuzzy-containment
  candidate → 0.5 stored as a suggestion (not auto-applied). High-confidence maps go
  live; medium/low go to the review queue with a suggested target.
### Changed
- import-assets now records confidence + suggested_asset_id + review_status per image
  (confirmed when auto-mapped, pending otherwise). Exported targetTableForType.

## 1.6.0-dev — 2026-06-16 (Manifest import pipeline + For Noobs)
### Added
- `pnpm slugs:export` — dumps every catalog target (category, slug, name, id) to
  data/catalog-slugs.csv + .json, so a manifest can be built/validated against real data.
- Manifest import (Option 1): a `manifest.json` or `manifest.csv` (file, category, slug)
  at the pack root now overrides folder/filename guessing during convert. Files named
  in the manifest are routed to the right category and renamed to the target slug, so
  the importer's slug auto-map hits the catalog exactly. Non-manifest files still fall
  back to folder classification.
- asset_pack_images now records `confidence`, `suggested_asset_id`, `review_status`
  (additive). Import sets confirmed/1.0 for mapped images and pending/0 for unmapped,
  laying the groundwork for the review queue.
- 'For Noobs' perk explanations: new `perks.noob_explanation`. Editable in the perk
  admin form; perk pages show 'Official Description' and a 'For Noobs:' section.
- Admin → Assets now explains what Assets, Asset Packs, Mapping, and Import each do.
### Deferred (next)
- No-manifest smart classifier with real confidence scoring + admin review queue UI
  (confirm/reject pending matches). Data columns are in place.

## 1.5.2-dev — 2026-06-16 (Build fix)
### Fixed
- asset-mapping.service `catalogCount`: dropped the `<string>` type argument on the
  `any`-typed `eb.fn.countAll()` call (dynamic-table query). TS forbids type arguments
  on untyped/any calls; the typed count queries on concrete tables keep their generic.

## 1.5.1-dev — 2026-06-16 (Build fixes)
### Fixed
- Type error in build-revisions: `BuildRevisionContent.difficulty_suggestion` is now
  typed `BuildDifficulty | null` (was `string | null`), matching the builds column so
  applying a revision compiles.
- Recommendations: `updateRecommendation` now passes a typed update object to Kysely
  `.set()` instead of `Record<string, unknown>` (would have failed typecheck on the
  admin edit/toggle path).

## 1.5.0-dev — 2026-06-16 (Asset diagnostics + mapping overview)
### Added
- `pnpm diagnose:assets` (scripts/diagnose-assets): read-only Asset Coverage Report.
  Per category (Perks, Killers, Survivors, Items, Add-ons, Maps): DB entries, imported
  assets, mapped, unmapped, duplicate target rows, ambiguous (name matches >1 entry),
  DB rows still missing icon_url/image_url, and example names for unmapped/missing
  records. Prints to console and writes data/asset-coverage-report.md.
- Admin → Mapping (/admin/assets/mapping): live coverage summary table + filterable
  list of every imported asset showing preview, source file, pack, type, target entity,
  mapped/unmapped status, and auto/manual mode. New `asset-mapping.service.ts`.
### Notes
- These are verification instruments; they read real data. Coverage has NOT been
  asserted here (no DB/pack in the build sandbox). Run diagnose:assets on the Pi to get
  true numbers before treating the mapping issue as resolved.

## 1.4.0-dev — 2026-06-16 (Asset auto-mapping + release docs)
### Fixed / Changed
- Asset auto-mapping coverage: `import:assets` now maps each asset to its catalog row
  by stored slug AND by a slug re-derived from the row's display name (same `toSlug`
  the asset filenames use), with a uniqueness guard so ambiguous names never
  mis-map. This is why many perk/character icons stayed blank: filename-derived slugs
  didn't equal the catalog's stored slug. Matching is preloaded + cached per target.
- Automatic mapping remains the default; manual overrides still win at resolve time.
### Investigation notes (no code change needed there)
- Persistence is correct: `public/assets` is kept in the named `assets` volume, so
  imported images survive `--build`. Render path (AssetThumb → img src) is correct.
  The container entrypoint already runs `import:assets` when a converted pack exists.
### Added
- Release-doc structure: PROJECT_HISTORY.md (milestones) and (current
  version + summary) now ship in every release alongside CHANGELOG.md / OPEN_TASKS.md.

## 1.3.0-dev — 2026-06-16 (Characters: tabs + sorting)
- No schema. Characters page gains All / Killers / Survivors tabs and sort options (Name A–Z, Name Z–A, Newest), all URL-driven and server-rendered into a single grid with a live count. Replaces the fixed two-section layout.

## 1.2.0-dev — 2026-06-16 (Popular & Trending builds)
- No schema. New `build-discovery.service.ts` computes Popular (all-time engagement) and Trending (last 7 days) rankings from existing build_likes / build_favorites / build_comments; hydrated via the existing order-preserving listBuildCardsByIds.
- Builds page shows 'Trending this week' + 'Popular builds' sections (top 6 each) on the default view, hidden automatically whenever any filter/search is active; an 'All builds' heading separates them from the full grid. Builds with no engagement are excluded from the ranked sections.

## 1.1.0-dev — 2026-06-15 (Perk Recommendations — killer-only)
- Migration (additive, idempotent): new `perk_recommendations` table (character_id, perk_id, note, sort_order, is_active, created_by) with unique (character_id, perk_id) and indexes. No existing table altered.
- Curated killer→perk suggestions. Killer-only is enforced in the service (rejects non-killer characters and survivor perks), the admin UI (killers only), and display (killer pages / killer builds only).
- Admin: /admin/recommendations — pick a killer, add a perk with a synergy note + order, toggle visibility, edit, delete. Staff-managed. Nav link added.
- Build form: when a killer is selected, a 'Recommended perks' callout shows the top 2 with an Add button that fills the next empty perk slot. Optional and advisory — it never modifies a build automatically. Shown in create and edit.
- Killer detail pages show a read-only 'Recommended perks' section.
- Survivor recommendations intentionally excluded (no unique power); future survivor guidance will be playstyle-based, not character-based.

## 1.0.0-dev — 2026-06-15 (Build Revision Workflow)
- Migration (additive, idempotent): new `build_revisions` table (snapshot model) with `status` text+CHECK, `content`/`base_snapshot` jsonb, review fields, indexes, and a partial unique index allowing one open revision per build. No existing table altered.
- Editing an approved/archived build now creates a **pending revision** instead of mutating the live build; the public version stays visible until a moderator approves. Resubmitting overwrites the open revision. Non-public builds are still edited in place.
- Approve applies the revision to the live build (title/character/difficulty + loadout + community tags) in one transaction, validating referenced ids; reject leaves the build unchanged. Slug and the staff editorial layer are never touched.
- Author: 'Edit build' link + 'revision awaiting review' banner on the build page; edit form prefilled from the live build.
- Staff: 'Revisions' queue (with nav badge) + side-by-side compare (before/after) and approve/reject with an optional review note. Revision history retained.

## 0.9.0-dev — 2026-06-15 (Profile System)
- Migration (additive, idempotent): profiles gain `is_public` (default true) and `playstyle_tags text[]`; new `profile_picks` table (favorite/hated killers & perks) with FK cascade, kind CHECK, uniqueness, and indexes. Defaults cover existing rows.
- Public profile pages at `/u/<username>`: avatar, bio, playstyle tags, join date, build/tier-list counts, Top Killers, Most Hated Killer, Favorite/Most-Hated Killer & Survivor Perks, public builds, public tier lists, favorite builds.
- Privacy: public shows everything; private shows only the identity shell to other users; owner + staff always see all; admins can clear a profile's content.
- Editor at `/account/profile`: preset avatar picker (shipped SVGs, no uploads), display name, bio, public/private toggle, playstyle tags, and searchable pick editors (caps: 3 killers / 1 hated killer / 6 per perk list).
- 'Favorite Survivors' intentionally omitted (cosmetic-only in DBD).

## 0.8.1-dev — 2026-06-15 (Admin bypass rules)
- Admins bypass the 30-day username-change cooldown, enforced consistently at the app layer (changeUsername), the DB trigger (profiles_before_update now exempts old.role = 'admin'), and the account UI (no cooldown notice for admins).
- Confirmed admins/staff already bypass content-ownership checks for moderation (tier-list delete, discussion thread/reply moderation, comment deletion, build delete/restore). Admin builds still pass through review by design (no silent auto-approve); can be made a toggle later.

## 0.8.0-dev — 2026-06-15 (User Management, Option B migration)
- Migration (additive, idempotent, non-destructive): `public.users` gains `status` (active/suspended/banned, default active, CHECK-constrained), `last_active_at`, and `deleted_at`, plus supporting indexes. Defaults cover existing rows; no backfill.
- Admin → Users page (admin-only): username, role, created, last active, status, with Activate / Suspend / Ban and Archive / Restore actions. Dashboard Users card and a nav link point to it.
- Enforcement: suspended/banned/archived users are blocked at login AND treated as logged out at the auth choke point (getUserIdFromToken); status/archive changes also clear the user's sessions. Admins can't lock out their own account.
- `last_active_at` is set on login (basis for the later inactivity cleanup).
- Not stored yet (future phases): user email (optional-email phase) and profile public/private (profile phase). Deletion is soft-only; no hard delete.

## 0.7.2-dev — 2026-06-15 (Admin delete/moderation, schema-free part)
- Admin build moderation: staff can soft-delete a build (reversible; sets deleted_at) and restore it, from both the admin Builds panel and the build detail page. Public reads already hide deleted builds; staff/author still see them.
- Staff can delete any tier list from the tier-list detail page (uses the existing owner-or-staff delete path; hard delete, cascades to entries/comments).
- Confirmed already-present coverage: staff deletion of any build comment (engagement.service) and soft-delete/restore of discussion threads & replies (discussion-moderation.service). Review-queue submissions = pending builds, covered by reject + delete.
- No schema change in this release. User/account deletion is the one remaining content type and needs a schema decision (see OPEN_TASKS / pending approval).

## 0.7.1-dev — 2026-06-15 (Phase B: build filtering & search)
- Builds page: filter by Killer/Survivor (role tabs + specific-character dropdown) and free-text search across build title, character name, and the names of perks / item / add-ons in each build's loadout.
- Tag filters moved out of the page header into a cleaner filter panel alongside search/role/character; URL-driven (?q=&role=&character=&tags=), all schema-free.
- New `searchApprovedBuilds()` service query (one bounded query + tag attach) and a `BuildsFilter` client panel; restored `listBuildCardsByIds`.

## 0.7.0-dev — 2026-06-14
- Automatic asset-pack import from Admin → Import: upload a ZIP (or select a ZIP/folder under data/assets/) and the server extracts it, auto-detects the real root (handles nested folders like `DBD_Icons_1/DBD_Icons_1`), converts into `data/assets/packs/<slug>/<category>/`, derives killer powers, and maps PNGs — with a live log. No Docker CLI paths required.
- `convert-old-assets` gained `resolveRoot()` nested-root auto-detection (also used by the CLI).
- New staff ZIP upload route (`/api/admin/assets/upload`, streamed to disk).
- docker-compose now bind-mounts `./data/assets` so uploads/converted packs persist and are visible host↔container. Added `adm-zip` dependency (rebuild required).
- Re-runs are safe; unmapped files never crash the import and remain assignable in Admin → Asset Packs.

## 0.6.9-dev — 2026-06-14
- Fixed importers failing inside Docker. The runtime image didn't include `src/`, so scripts that import a value from `src/lib/*` (`import:game` → `validations/game`, `import:assets` → `storage/local`) crashed with MODULE_NOT_FOUND. The Dockerfile now copies `src/` into the runner.
- Hardened `import:powers`: upsert is now keyed on `character_id` (respecting the one-power-per-killer constraint) with per-row try/catch, so it no longer aborts on re-runs or partial power data. Survivors are never required to have a power.
- Added an Admin → Import page (`/admin/import`) with buttons to run game / characters / powers / tier-list imports, import an asset pack, or convert+import a raw pack — staff-only, no shell needed. Documented the docker-compose commands.

## 0.6.8-dev — 2026-06-14 (Phase A: asset rendering)
- Build cards now show the killer/survivor portrait in the previously-empty area (`build-card.tsx`; the card query now selects `characters.image_url`).
- Build detail renders icons in the loadout: character portrait, per-perk icons, item icon, and add-on icons.
- Confirmed the characters list and perks list already render images via `AssetCard`/`AssetThumb` (those were data-gaps, not wiring gaps).
- Asset normalization fix for raw game-dump packs: `normalize.ts` now strips `K##_/S##_` portrait prefixes and the `_Portrait` suffix, and the converter maps `CharPortraits`→characters and `Favors`→offerings. Predicted character-portrait auto-mapping for the DBD_Icons pack rises from 0/96 to ~79/96.

## 0.6.7-dev — 2026-06-14
- Build fix: adding the `powers` asset category to the `AssetCategory` union left the admin Asset Packs page's exhaustive `Record<AssetCategory, string>` label map (and category list) without a `powers` entry. Added `powers: "Powers"` (and a Powers tab) so `pnpm build` typechecks.

## 0.6.6-dev — 2026-06-14
- **Full Killer Power roster coverage.** Added official `power_name` + a short `power_desc` for all 42 killers in `data/characters/catalog.json` (recent power names verified against official Dead by Daylight sources). `import-characters` now carries these into the `characters` table, so `import:powers` creates exactly one power row per killer and `Killer_Powers` icons can map to them by slug.

## 0.6.5-dev — 2026-06-14
- **Killer Powers are now a first-class feature.** Added a `powers` asset category to the importer (matches power icons to the existing `powers` table by normalized slug) and mapped the converter's `Killer_Powers` folder to it (previously `other`). The killer detail page now shows the power icon next to its name and description. Added `import:powers` (derives one power row per killer from `power_name`, idempotent, preserves importer-set icons) and wired it into the Docker bootstrap before asset import. Registered `powers` as a first-class category in the admin asset tools (manual override + missing/unmapped detection). Powers remain separate from perks and add-ons.

## 0.6.4-dev — 2026-06-14
- Fixed a database migration failure on **existing** databases (`column "character_id" does not exist`, SQLSTATE 42703): in `db/schema.sql` the idempotent `ALTER TABLE tier_list_entries ADD COLUMN IF NOT EXISTS character_id/map_id/target_type/custom_label` now run **before** the partial unique indexes that reference those columns. Non-destructive; no data loss.

## 0.6.3-dev — 2026-06-14
- Fixed a TypeScript build error in `perk-labels.service.ts`: filtered null `perk_id`s out of the tier-list-entry set before inserting into `perk_label_assignments` (a NOT NULL column), so `pnpm build` typechecks.

## 0.6.2-dev — 2026-06-14
- Fixed a TypeScript build error in `scripts/convert-old-assets` (`fs.readdir` Dirent typing) so `pnpm build` passes on Debian / Raspberry Pi arm64 with current `@types/node`.

## 0.6.1-dev — 2026-06-14
- Documentation streamlined into a forward-looking handover package.

## 0.6.0 — 2026-06-14
- Discussions voting UI (threads + replies) with guest sign-in prompt.
- Discussions moderation UI (hide/restore/lock) with staff-only visibility of
  hidden content.
- Related discussions on perk/character/build pages.
- Staff reports queue at `/admin/moderation`.
- Global search (nav bar + `/search`, grouped, partial matches).

## 0.5.0 — 2026-06-14
- Canonical environment template + setup docs; asset-import workflow and Docker
  auto-import of packs.

## 0.4.0
- Admin dashboard, maintenance mode, JSON backup (export/preview/apply), and an
  asset-pack converter.

## 0.3.0
- Discussions, multi-pack asset management + admin UI, runtime theme/content
  configuration, and user-created tier lists.

## 0.2.0
- Catalog, two-tier builds with review queue, logical generator, "My Perks",
  discovery layer, tier lists, multi-tag filter, perk labels.

## 0.1.0
- Foundation: self-hosted PostgreSQL + Kysely, local authentication, DB-backed
  sessions, local-filesystem asset storage, Docker.
