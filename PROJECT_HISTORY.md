# Fog Archives — Project History

Milestone timeline of completed phases (newest first). Detailed change lists live
in CHANGELOG.md; remaining work lives in OPEN_TASKS.md.

## 1.0.0-beta — Feature-complete / public beta (2026-06-16)
Tier-list consensus extended to maps; README and docs finalized; cleanup pass. The
platform is feature-complete and packaged for GitHub and deployment.

## 1.17.0-dev — Activity feed + item/add-on navigation (2026-06-16)
A unified community activity feed, completed item/add-on detail navigation, and
confirmation that build version history is fully wired (creation + revisions).

## 1.16.0-dev — Tier-list consensus + bulk For Noobs import (2026-06-16)
Community consensus placements aggregated across published tier lists, and a CSV bulk
importer for populating perk/power For Noobs explanations.

## 1.15.0-dev — For Noobs for killer powers (2026-06-16)
Extended the beginner-friendly “For Noobs:” explanation from perks to killer powers,
with admin editing and killer-page display. Feature complete for perks + powers.

## 1.14.0-dev — Build version history (2026-06-16)
An append-only build_versions timeline, recorded on revision approval and surfaced as a
“Revision history” section on build pages.

## 1.13.0-dev — Perk synergy (2026-06-16)
“Frequently paired with” on perk pages, computed from perk co-occurrence across approved
community builds.

## 1.12.0-dev — Email-backed auth flows (2026-06-16)
Username-or-email login, password reset, account restoration, and self-service deletion
confirmation — completing the email/account system on top of the 1.10.0 foundation.

## 1.11.0-dev — Search, polish & community meta (2026-06-16)
Search autocomplete + free-text perk search + standalone item/add-on pages; survivor
blue accent; character chapter/realm filters; a community meta (most-used) page.

## 1.10.0-dev — Email System Foundation (2026-06-16)
Email-required signup with hashed verification tokens, SMTP transport (dev-log fallback),
a soft verify-your-email nag, and opt-in newsletter/event preferences. Foundation for
recovery/restoration/deletion-confirmation flows (Phase B.2).

## 1.9.0-dev — Account deletion: tombstone + hard delete (2026-06-16)
Completed the account lifecycle: archived users can be anonymized (tombstone, default,
content preserved) or hard-deleted (admin-only, cascade, typed confirm). Audited.

## 1.8.0-dev — Audit log / review history (2026-06-16)
Append-only audit_log table + service + admin viewer; wired into the core moderation
and asset-review actions. Foundation for accountability and review history.

## 1.7.0-dev — Asset review queue + smart classifier (2026-06-16)
The asset system is now usable on messy ZIPs: a confidence-scored classifier auto-
confirms certain matches and routes the rest to an admin review queue (confirm / manual
map / reject / reset).

## 1.6.0-dev — Manifest import pipeline + For Noobs (2026-06-16)
Manifest-based asset import (slugs:export + manifest.json/csv) as the reliable primary
path; review metadata columns; beginner-friendly 'For Noobs:' perk explanations; admin
asset help text.

## 1.5.0-dev — Asset diagnostics + mapping overview (2026-06-16)
Added the `diagnose:assets` coverage report and the admin Mapping page to verify, with
real numbers, exactly which assets map and which catalog rows lack images.

## 1.4.0-dev — Asset auto-mapping + release docs (2026-06-16)
Raised asset→catalog auto-map coverage (slug + name-derived slug, unique-guarded);
established the standard release-doc set.

## 1.3.0-dev — Characters tabs + sorting (2026-06-16)
All/Killers/Survivors tabs and Name/Newest sorting on the characters page.

## 1.2.0-dev — Popular & Trending builds (2026-06-16)
Engagement-driven discovery sections on the Builds page (no schema).

## 1.1.0-dev — Perk recommendations, killer-only (2026-06-15)
Curated killer→perk suggestions with synergy notes; optional one-tap add in the
build form; read-only on killer pages. Survivor recs deferred (playstyle-based later).

## 1.0.0-dev — Build revision workflow (2026-06-15)
Edit an approved build → pending revision (live stays public) → staff compare +
approve/reject; revision history retained.

## 0.9.0-dev — Profile system (2026-06-15)
Public/private profiles at /u/<username>: preset avatars, bio, playstyle tags,
favorite/most-hated killers & perks, public builds/tier-lists/favorites; admin moderation.

## 0.8.x-dev — Admin bypass + user management
Admin bypass of the username cooldown; user status lifecycle (active/suspended/banned),
last_active_at, soft-delete/restore, site-wide enforcement.

## 0.7.x-dev — Search/filter + asset import pipeline
Build filtering & search (role/character/text/tags); automatic asset-pack
upload/convert/import; admin import tooling.

## 0.6.x-dev — Asset rendering + Docker import hardening
Asset images rendered across build cards/detail/lists; fixed Docker import crashes.

## Earlier
Core platform: builds (create/review/official editorial), tier lists, discussions,
characters/perks/items/add-ons catalog, auth (argon2id + DB sessions), Path B Docker
deploy on Raspberry Pi.
