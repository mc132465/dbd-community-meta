## 2026-06-16 · v1.4.0-beta · Convention-based asset resolution
**Technical summary:** Root cause of blank images was the multi-stage pipeline
(upload→classify→asset_pack_images→slug/name match→resolve into catalog column) — any stage
could silently drop an image. Replaced the display dependency with a pure convention: new
`src/lib/assets/resolve.ts` (`assetSrc`, `characterCategory`, `resolveAssetSrc`,
`AssetCategory`). `AssetThumb` is now a client component that resolves override-then-convention
and falls back to initials on null/404 (onError state). The catalog read layer
(`assets.service`) defaults `icon_url`/`image_url` to `/assets/<category>/<slug>.png` when null,
via `withCharacterImage`/`withIconUrl`/`withImageUrl`, covering characters, perks, items,
add-ons, maps, and killer powers everywhere they're consumed. `AssetCard` gained optional
category/slug passthrough. New `scripts/assets-missing/index.ts` + `pnpm assets:missing` report.
Created `public/assets/<category>/` folders. Old pack/mapping/review/import workflow retained
but documented as optional.
**Files/systems:** `lib/assets/resolve.ts`, `components/assets/asset-thumb.tsx`,
`components/assets/asset-card.tsx`, `lib/services/assets.service.ts`,
`scripts/assets-missing/index.ts`, `package.json`, `public/assets/*`,
`docs/asset-architecture.md`, `README.md`.
**Migrations:** none.
**Follow-up:** optionally retire the admin Asset Packs/Mapping/Review/Import pages once the
convention is confirmed in production.
**Remaining risks:** AssetThumb is now a client component (props are plain strings — safe).

## 2026-06-16 · v1.3.0-beta · Account consolidation + public-profile trim
**Technical summary:** /account rewritten as the comprehensive single source of truth —
status (users.status surfaced via getMyEmailStatus) + role display, UsernameForm, inline email
management (reusing setEmail/resendVerification/setEmailPrefs actions, now revalidating /account),
and inline self-deletion request (redirects to /account?deletion=…). /account/email and
/account/delete became redirects to /account; nag-banner and /verify links updated. Profile trim:
removed the four perk pick kinds — narrowed ProfilePickKind to fav_killer|hated_killer, trimmed
PICK_CAPS/PICK_KINDS, dropped PERK_KIND_ROLE, simplified ProfilePicks/loadProfilePicks/
setProfilePicks to character-only, and removed the perk PickEditors (profile editor) and PickRows
(public profile). profile_picks retained for killer picks.
**Files/systems:** account/{page,email/{page,actions},delete/{page,actions},profile/page};
email-account.service (EmailStatus.status); profile-public.service; profile/constants;
types/database (ProfilePickKind); u/[username]/page; layout/email-nag-banner; (main)/verify/page.
**Migrations:** none.
**Follow-up:** asset simplification (convention-based public/assets/<category>/<slug>.png) next.
**Remaining risks:** none notable.

## 2026-06-16 · v1.2.0-beta · Community Meta rename, content moderation + permanent delete, admin nav
**Technical summary:** Renamed the consensus feature to "Community Meta" (service symbols
communityMeta/CommunityMetaEntry/CommunityMetaCategory, route /tier-lists/community-meta, all
user-facing copy + home/README). New `moderation-content.service` provides admin-only listing
(builds/comments/tier_lists/discussions with search), per-type archive/restore (deleted_at, or
status for tier lists), and audit-first cascade `hardDelete`. New tabbed page
/admin/moderation/content with Open / Archive / permanent-delete (typed DELETE confirmation via
a server action). Admin layout nav regrouped into collapsible <details> dropdowns (Content,
Catalog, Community, System) with aggregate badges. Activity-feed entries are derived, so
permanent-deleting the source row removes them.
**Files/systems:** `services/tierlists.service.ts`, `app/(main)/tier-lists/community-meta/page.tsx`
(moved from consensus/), `tier-lists/page.tsx`, `app/page.tsx`, `README.md`;
`services/moderation-content.service.ts`, `app/admin/moderation/content/{page,actions}.tsx`,
`app/admin/layout.tsx`.
**Migrations:** none.
**Follow-up:** account-page consolidation; public-profile fav/hated-perk removal; optional
status filter on the moderation list.
**Remaining risks:** none notable.

# Development Log

Detailed internal development history. **Policy:** this log records only what the
project *became* — shipped features, applied migrations, released UI/admin/asset
changes, and architectural decisions that remain part of the system. It deliberately
omits discarded approaches, experiments, and debugging detours. User-facing release
notes live in `CHANGELOG.md`; the milestone timeline lives in `PROJECT_HISTORY.md`.

Each entry: Date · Version · Roadmap phase · Title · Technical summary · Files/systems ·
Migrations · Follow-up · Remaining risks. Newest first.

---

## 2026-06-16 · v1.0.0-beta · Feature-complete, finalization
**Feature:** Maps consensus + project finalization.
**Technical summary:** Extended `tierConsensus` with a `maps` branch (joins `maps` on
`map_id`, target_type 'map') and added a Maps column to /tier-lists/consensus. Refreshed the
README (status, full feature list, future-enhancements roadmap). Ran a cleanup pass: no
TODO/FIXME/placeholder comments or stray debug logging in source (the single console.log is
the documented dev email fallback), and `.env.example` contains only placeholder secrets.
**Files/systems:** `services/tierlists.service.ts`, `app/(main)/tier-lists/consensus/page.tsx`,
`README.md`, version/changelog/history docs.
**Migrations:** none.
**Follow-up (future enhancements, non-blocking):** per-user activity + feed pagination;
build-version diff view; recovery rate-limiting; expanded maps data.
**Remaining risks:** final tsc/next build/test run happens on the Pi (sandbox cannot execute).

## 2026-06-16 · v1.17.0-dev · Activity feed + item/add-on nav + version-history confirmation
**Feature:** Community activity feed; finished item/add-on navigation; verified build versioning.
**Technical summary:** New `activity.service` (`recentActivity`) caps and merges recent approved
builds, published tier lists, and non-deleted discussion threads, re-sorting by timestamp; a
read-only /activity page renders it with type badges (added to nav). Add-on list names and the
Meta item/add-on rankings now link to the existing detail pages. Audited the build-version
wiring: `reviewBuildAction` already records the initial 'created' entry on first approval
(guarded so it seeds once) and `approveRevision` records 'revision' entries; the only direct
`updateTable("builds")` calls outside revisions are soft-delete/restore, so no content edit
goes unversioned and 'staff_edit' remains intentionally reserved.
**Files/systems:** `services/activity.service.ts`, `app/(main)/activity/page.tsx`, `config/nav.ts`,
`app/(main)/add-ons/page.tsx`, `app/(main)/meta/page.tsx`.
**Migrations:** none.
**Follow-up:** optional per-user activity; pagination on the feed if volume grows.
**Remaining risks:** none notable.

## 2026-06-16 · v1.16.0-dev · Tier-list consensus + bulk For Noobs import
**Feature:** Community consensus aggregation + content tooling.
**Technical summary:** `tierConsensus(category)` aggregates a subject's tiers across all
published tier lists of that category (S=6…F=1), ranking by average tier then placement
count; rendered at /tier-lists/consensus for killers, survivors, and killer/survivor perks.
Separately, a `pnpm import:noob` script bulk-updates perks/powers `noob_explanation` (and
optional `description`) from a slug-keyed CSV, so all explanations can be filled in one pass.
**Files/systems:** `services/tierlists.service.ts` (+tierConsensus), `app/(main)/tier-lists/
consensus/page.tsx`, tier-lists index link; `scripts/import-noob/index.ts` + `import:noob`.
**Migrations:** none.
**Follow-up:** consensus for maps; cache aggregation if list volume grows.
**Remaining risks:** none notable.

## 2026-06-16 · v1.15.0-dev · For Noobs — killer powers
**Feature:** Beginner-friendly power explanations (extends the perk feature from 1.6.0).
**Technical summary:** Added `powers.noob_explanation`; `KillerPower` type + `getKillerPower`
now carry it; the powers admin config exposes a “For Noobs” textarea; the killer page renders
the power’s Official Description + a styled “For Noobs:” block, identical to the perk pattern.
**Files/systems:** schema `powers.noob_explanation`, `types/database.ts` (PowerRow, which is
also the Kysely table type), `services/assets.service.ts` (KillerPower + getKillerPower),
`admin/asset-config.ts` (powers fields), `app/(main)/characters/[slug]/page.tsx`.
**Migrations:** `powers.noob_explanation` (additive).
**Follow-up:** optional bulk import of explanation text from a CSV if provided.
**Remaining risks:** explanation content is author-entered (intentionally not generated).

## 2026-06-16 · v1.14.0-dev · Build version history (foundation)
**Feature:** Append-only timeline of a build's applied content.
**Technical summary:** New `build_versions` table + `build-versions.service` (`recordBuildVersion`
computes the next per-build version_no and inserts a snapshot; best-effort so it never breaks
the caller; `listBuildVersions` joins the author). Hooked into `approveRevision` — each approved
revision appends a `revision` entry (author = revision author, note = review note). Build detail
pages render a read-only “Revision history” section.
**Files/systems:** schema `build_versions`, `db/types.ts`, `services/build-versions.service.ts`,
`services/build-revisions.service.ts` (hook), `app/(main)/builds/[slug]/page.tsx` (history UI).
**Migrations:** new `build_versions` table.
**Follow-up:** record initial creation + direct staff edits as version entries; optional
content diff view between versions.
**Remaining risks:** none notable.

## 2026-06-16 · v1.13.0-dev · Perk synergy / related perks
**Feature:** “Frequently paired with” on perk detail pages.
**Technical summary:** New `relatedPerks(perkId)` self-joins `build_perks` (scoped to
approved, non-deleted builds) to rank co-occurring perks by pairing count, excluding the
perk itself. Rendered as linked chips with counts on the perk page.
**Files/systems:** `services/meta.service.ts` (+relatedPerks), `app/(main)/perks/[slug]/page.tsx`.
**Migrations:** none.
**Follow-up:** could extend the same co-occurrence approach to item+add-on pairings.
**Remaining risks:** none notable.

## 2026-06-16 · v1.12.0-dev · Phase B.2 — Email-backed auth flows
**Feature:** Recovery + lifecycle flows built on the email foundation.
**Technical summary:** Login now resolves a username or email (email branch matches the
stored lowercased address). New `account-recovery.service` implements password reset
(request always returns ok to avoid account enumeration; reset consumes a 1-hour token,
rehashes, and clears sessions), account restoration (archived + non-anonymized only), and
self-service deletion (logged-in request emails a confirmation; confirming archives the
account, clears sessions, and signs out — moderators still finalize). All token purposes
were already provisioned in `email_tokens`. Logged-out flows are fully server-rendered,
using redirect + query-param messaging (no client components).
**Files/systems:** `services/account-recovery.service.ts`, `services/auth.service.ts`
(identifier login), `validations/auth.ts` (signInSchema → identifier), `lib/email/send.ts`
(+3 templates), `components/auth/login-form.tsx`, `app/(auth)/{recovery-actions.ts,forgot,
reset,restore,confirm-delete}`, `app/account/delete/{page,actions}`, account email page link.
**Migrations:** none.
**Follow-up:** rate-limit recovery requests; optional email-change re-auth.
**Remaining risks:** real delivery depends on SMTP env (otherwise dev-log).

## 2026-06-16 · v1.11.0-dev · Phases C–E — Search, visual polish, community meta
**Feature:** Discovery + UX polish, no schema or new dependencies.
**Technical summary:** (C) Navbar SearchBar gained a debounced typeahead backed by a
`searchSuggestions()` service + server action reusing `discover()`; /perks gained a
free-text box on top of label filters; new /items and /add-ons search pages. (D) Survivor
role badge switched to a blue accent (also covers survivor-perk badges); /characters gained
chapter + realm filters that preserve the role tab and sort. (E) New `meta.service` +
/meta page ranking the most-used perks/killers/survivors/items/add-ons across approved,
non-deleted community builds.
**Files/systems:** `services/search.service.ts` (+ suggestions), `components/search/{search-bar,suggest-action}`,
`app/(main)/{perks,items,add-ons,characters,meta}/page.tsx`, `components/assets/asset-card.tsx`,
`services/meta.service.ts`, `config/nav.ts`.
**Migrations:** none.
**Follow-up:** item/add-on detail pages (the meta list links are text-only until those exist);
keyboard navigation for the suggestion dropdown.
**Remaining risks:** none notable.

## 2026-06-16 · v1.10.0-dev · Phase B — Email System Foundation
**Feature:** Email capture, verification, transport, and opt-in preferences.
**Technical summary:** New accounts now require a unique email, captured at signup and
confirmed via a hashed single-use token link. Added an SMTP transport (nodemailer) with a
console/log fallback when SMTP env is unset, so flows work in development. A self-fetching
soft nag banner prompts signed-in users without a verified email (never blocks). Account
settings gained an Email page to set/change the address, resend verification, and toggle
opt-in newsletter / event reminders (off by default).
**Files/systems:** `lib/email/{mailer,tokens,send}.ts`, `services/email-account.service.ts`,
`services/auth.service.ts` (signup stores email + sends verify), `validations/auth.ts`
(emailSchema + signup field), `components/auth/signup-form.tsx`,
`components/layout/email-nag-banner.tsx` + root layout, `app/(main)/verify/page.tsx`,
`app/account/email/{page,actions}.ts`. Dependency: `nodemailer` (+ `@types/nodemailer`).
**Migrations:** `users.email`, `users.email_verified_at`, unique index on `lower(email)`
where not null; `profiles.email_opt_newsletter`, `profiles.email_opt_events` (default
false); new `email_tokens` table (purpose verify/password_reset/delete_confirm/restore).
**Follow-up (Phase B.2):** email-or-username login; password reset; self-service deletion
confirmation; account restoration via token — the `email_tokens` purposes already exist.
**Remaining risks:** requires `pnpm install` (new dependency) + `db:migrate` before build;
real sending needs SMTP env (otherwise dev-log only).

## 2026-06-16 · v1.9.0-dev · Account lifecycle — deletion layer
**Feature:** Tombstone (default) + admin-only hard delete, from the archived state.
**Technical summary:** Tombstone anonymizes in place (blanks PII, frees username via
`deleted_<id8>`, sets `anonymized_at`, clears sessions) keeping all authored content as
“[deleted]”. Hard delete removes the user row (cascade) behind a typed-username
confirmation, writing the audit entry first. Username-cooldown trigger exempts the reserved
`deleted_` rename; signup rejects that prefix.
**Files/systems:** `services/user-admin.service.ts`, `admin/users/{page,actions}`,
`components/admin/hard-delete-form.tsx`, `validations/auth.ts`, schema trigger.
**Migrations:** `users.anonymized_at` (+ index); `profiles_before_update` trigger updated.
**Follow-up:** self-service deletion confirmation (lands with Phase B.2 email flows).
**Remaining risks:** hard delete is irreversible by design (mitigated by typed confirm + audit).

## 2026-06-16 · v1.8.0-dev · Audit log / review history
**Feature:** Append-only audit trail + admin viewer.
**Technical summary:** `audit_log` records staff actions with actor + metadata; `recordAudit`
resolves the actor from the session and is best-effort (never breaks the underlying action).
Wired into revision approve/reject, asset review confirm/reject/map/reset, and recommendation
add/delete. Read-only admin viewer with entity-type filter.
**Files/systems:** `services/audit.service.ts`, `admin/audit/page.tsx`, admin nav, and the
three action sets above.
**Migrations:** new `audit_log` table.
**Follow-up:** extend recording to more admin actions as they appear.
**Remaining risks:** none notable.

## 2026-06-16 · v1.7.0-dev · Asset review queue + smart classifier
**Feature:** Confidence-scored import + admin review of uncertain assets.
**Technical summary:** Importer classifies each image (exact slug 1.0 / unique name-slug 0.9
auto-confirmed; single fuzzy 0.5 suggestion). Low/medium-confidence images become a review
queue with Confirm / Manual map / Reject / Reset, plus a nav badge.
**Files/systems:** `scripts/import-assets`, `services/asset-review.service.ts`,
`admin/assets/review/{page,actions}`, admin nav.
**Migrations:** none (uses the 1.6.0 columns).
**Follow-up:** none.
**Remaining risks:** real coverage still to be confirmed via `diagnose:assets` on the Pi.

## 2026-06-16 · v1.6.0-dev · Manifest import + “For Noobs”
**Feature:** Deterministic manifest mapping + beginner-friendly perk text.
**Technical summary:** `slugs:export` dumps catalog targets; a `manifest.json/csv` (file →
category → slug) overrides folder/name guessing during convert. Perks gained a plain-English
“For Noobs:” explanation shown beside the official description.
**Files/systems:** `scripts/slugs-export`, `scripts/convert-old-assets`, `scripts/import-assets`,
`admin/asset-config`, perk page.
**Migrations:** `asset_pack_images.confidence/suggested_asset_id/review_status`;
`perks.noob_explanation`.
**Follow-up:** none.
**Remaining risks:** manifest must sit at the pack root.

## 2026-06-16 · v1.5.0-dev · Asset diagnostics + mapping overview
**Feature:** Read-only coverage report + admin mapping view.
**Technical summary:** `diagnose:assets` writes a per-category coverage report; admin Mapping
page shows a live summary + filterable list of every imported asset.
**Files/systems:** `scripts/diagnose-assets`, `services/asset-mapping.service.ts`,
`admin/assets/mapping/page.tsx`.
**Migrations:** none. **Follow-up:** run on the Pi to assert coverage. **Risks:** none.

## 2026-06-15/16 · v1.1.0–v1.4.0-dev · Discovery, characters, auto-mapping
**Features:** killer→perk recommendations (`perk_recommendations` table, admin-managed,
one-tap add in the build form); Popular/Trending build sections (computed from engagement);
Characters All/Killers/Survivors tabs + sorting; asset auto-mapping by stored slug **and**
unique name-slug (fixed blank icons).
**Migrations:** `perk_recommendations` (1.1.0). Others: none.
**Risks:** none notable.

## 2026-06-15 · v1.0.0-dev · Build revision workflow
**Feature:** Edit-approved-build → pending revision → staff approve/reject.
**Technical summary:** Snapshot model; live build stays public until approval; approve applies
in one transaction. Staff queue + before/after compare.
**Migrations:** new `build_revisions` table. **Follow-up:** same pattern can extend to tier
lists/discussions. **Risks:** none notable.

## 2026-06-15 · v0.9.0-dev · Profile system
**Feature:** Public/private profiles at `/u/<username>` + editor.
**Technical summary:** Preset SVG avatars, bio, playstyle tags, favorite/hated killers &
perks, public builds/tier-lists/favorites; privacy gating; admin clear-profile.
**Migrations:** `profiles.is_public`, `profiles.playstyle_tags`; new `profile_picks` table.
**Risks:** none notable.

## 2026-06-15 · v0.8.0–v0.8.1-dev · User management core
**Feature:** Account moderation + reversible archive.
**Technical summary:** `users.status` (active/suspended/banned), `last_active_at`,
`deleted_at` (archive); login + session-wide enforcement; sessions cleared on change. Admins
bypass the username-change cooldown (app + trigger + UI).
**Migrations:** the three `users` columns + indexes; cooldown trigger.
**Risks:** none notable.

## 2026-06-14/15 · v0.6.x–v0.7.x · Asset pipeline, filtering, moderation
**Features:** asset rendering across cards/detail/lists; killer Powers as a first-class
category; one-click ZIP import (upload → extract → convert → map) with persistent volumes;
build filtering & search; admin soft-delete/restore + content moderation.
**Migrations:** `powers` category support; migration-order correction for tier-list entries.
**Risks:** none notable.

## 2026-06-14 · v0.1.0–v0.5.0 · Foundation
**Feature:** Self-hosted core (“Path B”).
**Technical summary:** PostgreSQL + Kysely, argon2id local auth, DB-backed sessions,
local-filesystem asset storage, Docker; catalog, two-tier builds + review queue, generator,
tier lists, discussions, tags/perk labels, admin dashboard, maintenance mode, JSON backup,
runtime theme/content config.
**Migrations:** the initial schema (all core tables).
**Risks:** none notable.
