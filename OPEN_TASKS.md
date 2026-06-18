# Open Tasks / Roadmap

Phases are done one at a time with explicit approval. **[schema]** = changes the
database (stop-for-approval). ✅ = shipped, ◐ = partially shipped, ☐ = not started.

## Shipped so far
- ✅ Asset rendering everywhere (build cards, build detail, lists) — Phase A.
- ✅ Build filtering & search — Phase B: filter by Killer/Survivor (role + specific
  character), search across build title / character / perk / item / add-on names,
  tags in a filter panel.
- ✅ Automatic asset-pack import (upload/extract/auto-root/convert/map) from Admin →
  Import; per-category separation; manual assign for unmapped.
- ✅ Admin delete/restore for builds (soft), staff delete for tier lists, comment
  deletion, discussion thread/reply soft-delete + restore.
- ✅ User management core — status (active/suspended/banned), last_active_at,
  deleted_at; suspend/ban/activate + archive/restore; login + site-wide enforcement.

## Next up (agreed priority order)
3. ✅ **Admin bypass rules** (0.8.1-dev): admins bypass the username cooldown (app +
   trigger + UI); staff already bypass content-ownership for moderation.
4. ✅ **Profile system** (0.9.0-dev): public/private profiles at /u/<username>,
   preset avatars, bio, playstyle tags, Top Killers + Most Hated Killer + Favorite/
   Hated Killer & Survivor Perks, public builds/tier-lists/favorites, admin moderation.
5. ✅ **Edit + resubmit / build revision workflow** (1.0.0-dev): edit an
   approved build → pending revision (live stays public) → staff compare +
   approve/reject; history retained. Same pattern can extend to tier lists/discussions.
6. ✅ **Recommendation system** (1.1.0-dev): curated killer→perk suggestions
   (admin-managed, with synergy notes); optional one-tap add in the build form + read-only
   on killer pages. Survivor recs deferred → future playstyle-based guidance.

---

# Categorized backlog (future)

## Next after asset pipeline (queued)
- ✅ Audit log / review history (1.8.0-dev): audit_log table + service + admin
  viewer, wired into revisions / asset review / recommendations.
- ✅ User deletion/archive finalization (1.9.0-dev): tombstone (default) + admin-only
  hard delete, from the archive, audited.
- ✅ Email account system complete: foundation (1.10.0) + Phase B.2 (1.12.0) — username/
  email login, password reset, account restoration, self-service deletion confirmation.


## Asset pipeline (Option 1 — manifest)
- ✅ slugs:export, manifest.json/csv import, review columns, admin help (1.6.0-dev).
- ✅ No-manifest smart classifier + admin review queue UI (1.7.0-dev): confirm /
  manual map / reject / reset, confidence-scored, suggestions for uncertain matches.
- ✅ 'For Noobs' perk explanations (1.6.0-dev).

## Asset mapping verification (open until proven)
- ☐ Run `pnpm diagnose:assets`; mapping is NOT considered fixed until the report
  shows near-100% for Perks, Killers, Survivors. Use Admin → Mapping to inspect
  unmapped rows and apply manual overrides where auto-map can't disambiguate.


## Content & Moderation
- ✅ Delete builds / tier lists / discussions / comments after approval; ✅ restore
  soft-deleted content.
- ☐ Recent Activity cleanup tools (hide/clear entries; don't show deleted items).
- ☐ Review history — who approved/rejected and when (audit trail). [schema]

## Build System
- ☐ Build revision workflow: user edits an approved build -> old version stays public,
  new version enters the review queue -> admin approves/rejects the revision. [schema]
- ✅ Build version history complete (1.14.0 revisions + 1.17.0 confirmation: creation
  recorded on first approval; staff_edit reserved — no un-versioned content edits).
- ☐ Recommended perks by Killer / by Survivor; recommended add-ons by Killer. [schema]
- ✅ Popular builds + Trending builds sections (1.2.0-dev): computed from existing
  engagement; shown on the default Builds view, hidden when filtering.

## Search & Discovery
- ◐ Build search by perk / killer / survivor (done in Phase B); item/add-on names too.
- ☐ Live search suggestions (autocomplete + "no results" state).
- ☐ Standalone character / perk / item / add-on search.
- ☐ Advanced filter panel.

## Profiles  [schema]
- ☐ Preset avatar system (no custom uploads), user bio, public/private setting.
- ☐ Favorite builds; favorite Killers; favorite Survivors; most-hated Killer;
  most-hated Perks (killer + survivor, shown separately); playstyle tags.
- ☐ Public profile pages; profile activity feed; profile statistics.

## Characters
- ◐ Killer / Survivor / All tabs + sorting (1.3.0-dev). Character-specific filters
  (chapter/realm) still open.
- ☐ Character popularity statistics.
- ☐ Configurable Survivor color (blue).

## Perks
- ☐ Blue Survivor perk badge; more filter options.
- ☐ Patch-impact indicators; related perks section; synergy suggestions.

## Tier Lists
- ✅ User-created tier lists (exist). ✅ Tier list comments (exist).
- ✅ Tier-list consensus / popularity (1.16.0-dev)
  patch-specific tier lists.

## Patch System
- ☐ Patch archive; patch notes page; buffs/nerfs section.
- ☐ Patch impact on perks / killers / survivors.

## Maps
- ☐ Map database; map statistics; map guides; killer- and survivor-specific ratings.

## Admin
- ☐ User management expansion; optional email management + recovery tools. [schema]
- ☐ Audit log. [schema]
- ◐ ZIP import wizard (auto-import shipped); ✅ auto-mapping by slug+name (1.4.0-dev);
  asset import statistics; asset mapping overview; asset validation report; bulk actions.

## Community  [schema]
- ☐ Follow users; favorite creators; notifications.
- ☐ Saved builds / saved tier lists; user reputation; creator badges.

## Analytics
- ☐ Most viewed / most liked builds; most used perks / killers; trending; meta overview.

## Long-term
- ☐ Account inactivity cleanup (~6 months, esp. no-email accounts) - basis already in
  place via users.last_active_at / deleted_at.
- ☐ Launcher integration research; mobile app research.
- ☐ Recommendation engine v2; personalized recommendations; seasonal events.

---

## Cross-cutting policy
- Optional email: stays optional, never blocks community features (comment, build,
  tier list, vote). Email only unlocks recovery, password reset, a recovery window
  (~30 days), and notifications. (No email column stored yet.)
- Soft-delete first: deletion is reversible (soft-delete/archive) wherever a column
  exists; hard delete is avoided.

## Release process (required every release)
- Static-check, repackage the ZIP, summarize what changed between versions.

## For Noobs
- ✅ Feature complete for perks (1.6.0) and killer powers (1.15.0). Text authored via
  admin, or bulk-imported via `pnpm import:noob` (1.16.0).
