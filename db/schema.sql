-- =====================================================================
-- db/schema.sql — SINGLE SOURCE OF TRUTH for the local PostgreSQL schema.
--
-- Path B: plain PostgreSQL with local auth + sessions. This is the single
-- source of truth for the schema — vanilla Postgres only:
--   * local `users` + `sessions` tables (no external auth provider)
--   * assets on the local filesystem (no object-storage service)
--   * no RLS / policies         -> authorization is enforced in the app layer
--
-- Idempotent: safe to re-run with `pnpm db:migrate`. Use `pnpm db:reset` to drop
-- and rebuild the public schema from scratch.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('user', 'moderator', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'game_role') then
    create type public.game_role as enum ('killer', 'survivor');
  end if;
  if not exists (select 1 from pg_type where typname = 'addon_rarity') then
    create type public.addon_rarity as enum
      ('common', 'uncommon', 'rare', 'very_rare', 'ultra_rare', 'event');
  end if;
  if not exists (select 1 from pg_type where typname = 'addon_target') then
    create type public.addon_target as enum ('killer_power', 'item');
  end if;
  if not exists (select 1 from pg_type where typname = 'build_difficulty') then
    create type public.build_difficulty as enum
      ('beginner', 'intermediate', 'advanced');
  end if;
  if not exists (select 1 from pg_type where typname = 'build_status') then
    create type public.build_status as enum
      ('pending_review', 'approved', 'rejected', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum ('build_submitted');
  end if;
end $$;

-- ---------- Local auth: users + sessions ----------
-- Credentials only. Public profile data lives in `profiles`.
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- User lifecycle (User Management phase). Additive + idempotent: defaults cover
-- existing rows, no backfill, nothing destructive.
--   status         active | suspended | banned   (suspended/banned can't log in)
--   last_active_at last seen (set on login; basis for inactivity cleanup later)
--   deleted_at     soft-delete / archive (reversible; hidden from public + login)
alter table public.users
  add column if not exists status text not null default 'active';
alter table public.users
  add column if not exists last_active_at timestamptz;
alter table public.users
  add column if not exists deleted_at timestamptz;
-- anonymized_at: set when a user is permanently tombstoned (PII blanked, username
-- freed). deleted_at = reversible archive; anonymized_at = terminal anonymization.
alter table public.users
  add column if not exists anonymized_at timestamptz;
-- Email (optional for grandfathered accounts; required for new signups at the app
-- layer). Used for verification, recovery, and opt-in communications.
alter table public.users
  add column if not exists email text;
alter table public.users
  add column if not exists email_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_status_check'
  ) then
    alter table public.users
      add constraint users_status_check
      check (status in ('active', 'suspended', 'banned'));
  end if;
end $$;

create index if not exists users_status_idx on public.users (status);
create index if not exists users_last_active_idx on public.users (last_active_at);
create index if not exists users_deleted_at_idx on public.users (deleted_at);
create index if not exists users_anonymized_at_idx on public.users (anonymized_at);
-- Case-insensitive email uniqueness, enforced only when an email is present.
create unique index if not exists users_email_lower_key
  on public.users (lower(email)) where email is not null;

create table if not exists public.profiles (
  id                      uuid primary key references public.users (id) on delete cascade,
  username                text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name            text,
  avatar_url              text,
  bio                     text check (char_length(bio) <= 500),
  role                    public.user_role not null default 'user',
  last_username_change_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Profile system (additive + idempotent). Community profile fields:
--   is_public      profile visibility (public shows favorites/picks/activity)
--   playstyle_tags preset playstyle keys (validated in the app)
alter table public.profiles
  add column if not exists is_public boolean not null default true;
alter table public.profiles
  add column if not exists playstyle_tags text[] not null default '{}';
-- Opt-in communication preferences (default off). Transactional email is always allowed.
alter table public.profiles
  add column if not exists email_opt_newsletter boolean not null default false;
alter table public.profiles
  add column if not exists email_opt_events boolean not null default false;

-- Opaque session cookie token is stored hashed; cookie holds the raw token.
create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions (user_id);
create index if not exists sessions_expires_idx on public.sessions (expires_at);

-- ---------- Assets: patches / characters / perks / items / add-ons / maps ----------
create table if not exists public.patches (
  id          uuid primary key default gen_random_uuid(),
  version     text not null unique,
  name        text,
  released_at date,
  notes       text,
  source      text,
  external_id text,
  created_at  timestamptz not null default now()
);

create table if not exists public.characters (
  id               uuid primary key default gen_random_uuid(),
  role             public.game_role not null,
  name             text not null,
  slug             text not null unique,
  title            text,
  lore             text,
  power_name       text,
  power_desc       text,
  image_url        text,
  home_realm       text,
  chapter          text,
  description      text,
  release_patch_id uuid references public.patches (id) on delete set null,
  source           text,
  external_id      text,
  created_at       timestamptz not null default now()
);
create index if not exists characters_role_idx on public.characters (role);
create index if not exists characters_source_idx on public.characters (source, external_id);

-- Chapters / licenses as a first-class entity. The free-text characters.chapter
-- is retained for compatibility; chapter rows + the chapter_id link are
-- populated by import:characters (so they fill on fresh installs after the
-- catalog is imported). Created before the characters ALTER so the FK is valid.
create table if not exists public.chapters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  kind        text,            -- 'original' | 'licensed' (nullable; unknown for now)
  released_at date,
  source      text,
  external_id text,
  created_at  timestamptz not null default now()
);
alter table public.characters
  add column if not exists chapter_id uuid references public.chapters (id) on delete set null;
create index if not exists characters_chapter_idx on public.characters (chapter_id);

create table if not exists public.perks (
  id                  uuid primary key default gen_random_uuid(),
  role                public.game_role,                 -- nullable (pack omits role)
  name                text not null,
  slug                text not null unique,
  description         text,
  noob_explanation    text,
  icon_url            text,
  origin_character_id uuid references public.characters (id) on delete set null,
  is_teachable        boolean not null default false,
  source              text,
  external_id         text,
  created_at          timestamptz not null default now()
);
create index if not exists perks_role_idx on public.perks (role);
create index if not exists perks_origin_idx on public.perks (origin_character_id);
-- Beginner-friendly perk explanation (additive). Shown as "For Noobs:" on perk pages.
alter table public.perks add column if not exists noob_explanation text;

-- ---------- Profile picks (favorite/hated killers & perks) ----------
-- One row per selection. `kind` constrains which target column is used; the app
-- enforces caps (3 favorite killers, 1 hated killer, up to 6 per perk list).
create table if not exists public.profile_picks (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in (
                 'fav_killer', 'hated_killer',
                 'fav_killer_perk', 'fav_survivor_perk',
                 'hated_killer_perk', 'hated_survivor_perk')),
  character_id uuid references public.characters (id) on delete cascade,
  perk_id      uuid references public.perks (id) on delete cascade,
  rank         smallint not null default 0,
  created_at   timestamptz not null default now(),
  check (
    (kind in ('fav_killer', 'hated_killer')
       and character_id is not null and perk_id is null)
    or
    (kind in ('fav_killer_perk', 'fav_survivor_perk',
              'hated_killer_perk', 'hated_survivor_perk')
       and perk_id is not null and character_id is null)
  )
);
create unique index if not exists profile_picks_uniq
  on public.profile_picks (profile_id, kind, coalesce(character_id, perk_id));
create index if not exists profile_picks_profile_idx
  on public.profile_picks (profile_id);

-- ---------- Perk recommendations (curated, killer-only for v1) ----------
-- Curated (killer character -> perk) suggestions surfaced in the build form and
-- on killer detail pages. Optional and advisory: they never modify a build. The
-- killer-only rule and killer/perk role match are enforced in the service +
-- admin UI (cross-table rules can't live in a CHECK). Additive; nothing altered.
create table if not exists public.perk_recommendations (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  perk_id      uuid not null references public.perks (id) on delete cascade,
  note         text,
  sort_order   smallint not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (character_id, perk_id)
);
create index if not exists perk_recommendations_character_idx
  on public.perk_recommendations (character_id);
create index if not exists perk_recommendations_active_idx
  on public.perk_recommendations (character_id, is_active);

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  category    text,
  description text,
  icon_url    text,
  source      text,
  external_id text,
  created_at  timestamptz not null default now()
);

create table if not exists public.add_ons (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  rarity              public.addon_rarity not null default 'common',
  applies_to          public.addon_target,              -- nullable (pack omits target)
  parent_character_id uuid references public.characters (id) on delete set null,
  parent_item_id      uuid references public.items (id) on delete set null,
  description         text,
  icon_url            text,
  source              text,
  external_id         text,
  created_at          timestamptz not null default now(),
  constraint add_ons_parent_consistency check (
    applies_to is null
    or (applies_to = 'killer_power' and parent_item_id is null)
    or (applies_to = 'item' and parent_character_id is null)
  )
);
create index if not exists add_ons_parent_character_idx on public.add_ons (parent_character_id);
create index if not exists add_ons_parent_item_idx on public.add_ons (parent_item_id);

create table if not exists public.maps (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  realm       text,
  image_url   text,
  source      text,
  external_id text,
  created_at  timestamptz not null default now()
);

create table if not exists public.powers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  noob_explanation text,
  icon_url     text,
  character_id uuid references public.characters (id) on delete set null,
  source       text,
  external_id  text,
  created_at   timestamptz not null default now()
);
create index if not exists powers_character_idx on public.powers (character_id);
create index if not exists powers_source_idx on public.powers (source, external_id);

-- Enforce "exactly one primary power per killer". Before creating the unique
-- index, normalize any pre-existing duplicates (keep one row per killer:
-- prefer a row that already has an icon, then the earliest). This only affects
-- already-invalid duplicate rows; the kept row preserves any imported icon.
delete from public.powers p
using (
  select id,
    row_number() over (
      partition by character_id
      order by (icon_url is not null) desc, created_at asc, id asc
    ) as rn
  from public.powers
  where character_id is not null
) ranked
where p.id = ranked.id and ranked.rn > 1;
create unique index if not exists powers_one_per_killer
  on public.powers (character_id) where character_id is not null;

-- Killer-power add-ons can attach to the specific power (not just the killer
-- character). Added after powers exists so the FK is valid on a fresh database;
-- parent_character_id is retained for backwards compatibility.
alter table public.add_ons
  add column if not exists power_id uuid references public.powers (id) on delete set null;
create index if not exists add_ons_power_idx on public.add_ons (power_id);

-- For Noobs explanation on powers (additive). Shown on the killer page.
alter table public.powers add column if not exists noob_explanation text;

create table if not exists public.offerings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  icon_url    text,
  source      text,
  external_id text,
  created_at  timestamptz not null default now()
);
create index if not exists offerings_source_idx on public.offerings (source, external_id);

create table if not exists public.status_effects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  icon_url    text,
  source      text,
  external_id text,
  created_at  timestamptz not null default now()
);
create index if not exists status_effects_source_idx on public.status_effects (source, external_id);

-- ---------- Asset packs (visual layers) ----------
create table if not exists public.asset_packs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  source_folder text,
  is_default    boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index if not exists asset_packs_one_default
  on public.asset_packs (is_default) where is_default;

-- For existing databases: add the new pack metadata columns.
alter table public.asset_packs add column if not exists description text;
alter table public.asset_packs add column if not exists source_folder text;

insert into public.asset_packs (name, slug, is_default, is_active)
values ('Default', 'default', true, true)
on conflict (slug) do nothing;

-- asset_pack_images is the authoritative per-pack image inventory. Every image
-- found in a pack is recorded here, mapped (asset_id set) or unmapped
-- (asset_id null). asset_type is category-scoped; auto-mapping only ever
-- matches a target within the same category.
create table if not exists public.asset_pack_images (
  id           uuid primary key default gen_random_uuid(),
  pack_id      uuid not null references public.asset_packs (id) on delete cascade,
  asset_type   text not null check (asset_type in (
    'perks', 'killers', 'survivors', 'characters', 'items',
    'add_ons', 'maps', 'offerings', 'other'
  )),
  asset_id     uuid,
  source_file  text not null default '',
  derived_slug text,
  mapping_mode text not null default 'auto' check (mapping_mode in ('auto', 'manual')),
  storage_path text not null,
  image_url    text not null,
  confidence   real,
  suggested_asset_id uuid,
  review_status text check (review_status is null or review_status in ('pending', 'confirmed', 'rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (pack_id, asset_type, source_file)
);

-- For existing databases: widen category check, allow unmapped (nullable
-- asset_id), and add source_file / derived_slug / mapping_mode.
alter table public.asset_pack_images add column if not exists source_file text not null default '';
alter table public.asset_pack_images add column if not exists derived_slug text;
alter table public.asset_pack_images add column if not exists mapping_mode text not null default 'auto';
alter table public.asset_pack_images alter column asset_id drop not null;
alter table public.asset_pack_images drop constraint if exists asset_pack_images_asset_type_check;
alter table public.asset_pack_images add constraint asset_pack_images_asset_type_check
  check (asset_type in ('perks', 'killers', 'survivors', 'characters', 'items', 'add_ons', 'maps', 'offerings', 'other'));
alter table public.asset_pack_images drop constraint if exists asset_pack_images_mapping_mode_check;
alter table public.asset_pack_images add constraint asset_pack_images_mapping_mode_check
  check (mapping_mode in ('auto', 'manual'));
-- Smart-import metadata (additive): per-image confidence, a suggested target for
-- low-confidence matches, and a review status for the manifest/classifier flow.
alter table public.asset_pack_images add column if not exists confidence real;
alter table public.asset_pack_images add column if not exists suggested_asset_id uuid;
alter table public.asset_pack_images add column if not exists review_status text;
alter table public.asset_pack_images drop constraint if exists asset_pack_images_review_status_check;
alter table public.asset_pack_images add constraint asset_pack_images_review_status_check
  check (review_status is null or review_status in ('pending', 'confirmed', 'rejected'));
alter table public.asset_pack_images drop constraint if exists asset_pack_images_pack_id_asset_type_asset_id_key;
alter table public.asset_pack_images drop constraint if exists asset_pack_images_pack_id_asset_type_source_file_key;
alter table public.asset_pack_images add constraint asset_pack_images_pack_id_asset_type_source_file_key
  unique (pack_id, asset_type, source_file);

create index if not exists asset_pack_images_lookup on public.asset_pack_images (asset_type, asset_id);
create index if not exists asset_pack_images_pack_idx on public.asset_pack_images (pack_id);
create index if not exists asset_pack_images_slug_idx on public.asset_pack_images (asset_type, derived_slug);

-- ---------------------------------------------------------------------------
-- Site settings: simple key/value store for runtime-configurable theme colors
-- and small site texts. Edited from the admin panel; read at request time and
-- injected as CSS variables, so changes apply without a rebuild/redeploy.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ---------- Tags ----------
create table if not exists public.tag_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.tag_categories (name, slug, sort_order) values
  ('General', 'general', 1),
  ('Killer', 'killer', 2),
  ('Survivor', 'survivor', 3)
on conflict (slug) do nothing;

create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  category_id uuid references public.tag_categories (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tags_category_idx on public.tags (category_id);
create index if not exists tags_active_idx on public.tags (is_active);

insert into public.tags (name, slug, category_id)
select v.name, v.slug, c.id
from (values
  ('Competitive', 'competitive', 'general'),
  ('Endgame', 'endgame', 'general'),
  ('Stealth', 'stealth', 'general'),
  ('Chase Focused', 'chase_focused', 'general'),
  ('Solo Queue', 'solo_queue', 'survivor'),
  ('SWF', 'swf', 'survivor'),
  ('Gen Pressure', 'gen_pressure', 'killer'),
  ('Anti-Healing', 'anti_healing', 'killer')
) as v(name, slug, cat)
join public.tag_categories c on c.slug = v.cat
on conflict (slug) do nothing;

-- ---------- Builds (structured, community-owned) ----------
create table if not exists public.builds (
  id                    uuid primary key default gen_random_uuid(),
  author_id             uuid not null references public.profiles (id) on delete cascade,
  title                 text,
  slug                  text not null unique,
  role                  public.game_role not null,
  character_id          uuid references public.characters (id) on delete set null,
  difficulty_suggestion public.build_difficulty,
  patch_id              uuid references public.patches (id) on delete set null,
  status                public.build_status not null default 'pending_review',
  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  review_note           text,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists builds_status_idx on public.builds (status);
create index if not exists builds_author_idx on public.builds (author_id);
create index if not exists builds_character_idx on public.builds (character_id);
create index if not exists builds_role_idx on public.builds (role);

-- ---------- Build revisions (edit-after-approval workflow) ----------
-- An author editing an APPROVED build creates a revision here instead of
-- mutating the live build. Staff approve (apply to the build) or reject. The
-- live build, its slug, engagement, and staff editorial layer are untouched
-- until approval. `content`/`base_snapshot` are JSON payloads of user-editable
-- fields only. Additive; no existing table is changed.
create table if not exists public.build_revisions (
  id            uuid primary key default gen_random_uuid(),
  build_id      uuid not null references public.builds (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending_review'
                  check (status in ('pending_review', 'approved', 'rejected', 'superseded')),
  content       jsonb not null,
  base_snapshot jsonb,
  author_note   text,
  review_note   text,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists build_revisions_build_idx
  on public.build_revisions (build_id);
create index if not exists build_revisions_status_idx
  on public.build_revisions (status);
-- At most one open revision per build (resubmit overwrites the open one).
create unique index if not exists build_revisions_one_open
  on public.build_revisions (build_id) where status = 'pending_review';

create table if not exists public.build_perks (
  build_id uuid not null references public.builds (id) on delete cascade,
  perk_id  uuid not null references public.perks (id) on delete cascade,
  slot     int  not null check (slot between 1 and 4),
  primary key (build_id, slot)
);

create table if not exists public.build_add_ons (
  build_id  uuid not null references public.builds (id) on delete cascade,
  add_on_id uuid not null references public.add_ons (id) on delete cascade,
  slot      int  not null check (slot between 1 and 2),
  primary key (build_id, slot)
);

create table if not exists public.build_item (
  build_id uuid primary key references public.builds (id) on delete cascade,
  item_id  uuid not null references public.items (id) on delete cascade
);

create table if not exists public.build_editorials (
  build_id               uuid primary key references public.builds (id) on delete cascade,
  overall_strategy       text,
  strengths              text,
  weaknesses             text,
  recommended_difficulty public.build_difficulty,
  is_featured            boolean not null default false,
  editor_id              uuid references public.profiles (id) on delete set null,
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists build_editorials_featured_idx
  on public.build_editorials (is_featured) where is_featured = true;

create table if not exists public.build_perk_explanations (
  build_id   uuid not null references public.builds (id) on delete cascade,
  slot       int  not null check (slot between 1 and 4),
  reason     text not null,
  editor_id  uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (build_id, slot)
);

create table if not exists public.build_tags (
  build_id uuid not null references public.builds (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  primary key (build_id, tag_id)
);
create index if not exists build_tags_tag_idx on public.build_tags (tag_id);

create table if not exists public.build_editorial_tags (
  build_id uuid not null references public.builds (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  primary key (build_id, tag_id)
);
create index if not exists build_editorial_tags_tag_idx on public.build_editorial_tags (tag_id);

-- ---------- Notifications (staff-facing; written by trigger) ----------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  type         public.notification_type not null,
  build_id     uuid references public.builds (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  payload      jsonb not null default '{}',
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_unprocessed_idx
  on public.notifications (created_at) where processed_at is null;

-- ---------- Community engagement: likes / favorites / comments (Phase 3) ----------
-- One like per user per build (composite PK). Likes are only created on approved
-- builds; that rule is enforced in the application layer.
create table if not exists public.build_likes (
  build_id   uuid not null references public.builds (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);
create index if not exists build_likes_build_idx on public.build_likes (build_id);

-- One favorite (saved build) per user per build.
create table if not exists public.build_favorites (
  build_id   uuid not null references public.builds (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);
create index if not exists build_favorites_user_idx on public.build_favorites (user_id);

-- Public comments on builds. Soft-deleted (deleted_at/deleted_by) so moderation
-- is non-destructive; public reads filter deleted_at is null. No threading.
create table if not exists public.build_comments (
  id         uuid primary key default gen_random_uuid(),
  build_id   uuid not null references public.builds (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists build_comments_build_idx
  on public.build_comments (build_id, created_at);

-- ---------- Tier lists (Phase 4) ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tier_list_status') then
    create type public.tier_list_status as enum ('draft', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'tier_rank') then
    create type public.tier_rank as enum ('S', 'A', 'B', 'C', 'D', 'F');
  end if;
end $$;

-- A tier list ranks perks into tiers. author_id is nullable + ON DELETE SET NULL
-- so curated/reference lists survive an author's account removal.
create table if not exists public.tier_lists (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references public.profiles (id) on delete set null,
  title        text not null,
  slug         text not null unique,
  description  text,
  category     text not null default 'killer_perks' check (category in (
    'killer_perks', 'survivor_perks', 'killers', 'survivors', 'maps', 'other'
  )),
  tier_labels  jsonb not null default '["S","A","B","C","D","F"]'::jsonb,
  is_official  boolean not null default false,
  source       text,
  status       public.tier_list_status not null default 'draft',
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tier_lists_status_idx on public.tier_lists (status);

-- For existing databases: add category + configurable tier labels.
alter table public.tier_lists add column if not exists category text not null default 'killer_perks';
alter table public.tier_lists drop constraint if exists tier_lists_category_check;
alter table public.tier_lists add constraint tier_lists_category_check
  check (category in ('killer_perks', 'survivor_perks', 'killers', 'survivors', 'maps', 'other'));
alter table public.tier_lists add column if not exists tier_labels jsonb not null default '["S","A","B","C","D","F"]'::jsonb;

-- A target's placement within a tier list. The target is polymorphic: a perk,
-- a character (killer/survivor), a map, or a free-form custom label ("other").
-- `tier` is free text so lists can define their own ordered tier_labels.
create table if not exists public.tier_list_entries (
  id           uuid primary key default gen_random_uuid(),
  tier_list_id uuid not null references public.tier_lists (id) on delete cascade,
  perk_id      uuid references public.perks (id) on delete cascade,
  character_id uuid references public.characters (id) on delete cascade,
  map_id       uuid references public.maps (id) on delete cascade,
  target_type  text not null default 'perk' check (target_type in (
    'perk', 'character', 'map', 'custom'
  )),
  custom_label text,
  tier         text not null,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
-- For existing databases: generalize the entry target model BEFORE creating any
-- index that references the new columns. On an upgraded database the
-- create-table-if-not-exists above is a no-op, so these ALTERs are what actually
-- add character_id/map_id/target_type/custom_label; they must run before the
-- partial unique indexes that reference them (otherwise: "column does not exist").
alter table public.tier_list_entries alter column perk_id drop not null;
alter table public.tier_list_entries add column if not exists character_id uuid references public.characters (id) on delete cascade;
alter table public.tier_list_entries add column if not exists map_id uuid references public.maps (id) on delete cascade;
alter table public.tier_list_entries add column if not exists target_type text not null default 'perk';
alter table public.tier_list_entries drop constraint if exists tier_list_entries_target_type_check;
alter table public.tier_list_entries add constraint tier_list_entries_target_type_check
  check (target_type in ('perk', 'character', 'map', 'custom'));
alter table public.tier_list_entries add column if not exists custom_label text;
-- Migrate tier from the tier_rank enum to text (no-op if already text); existing
-- S/A/B/C/D/F values are preserved verbatim.
alter table public.tier_list_entries alter column tier type text using tier::text;
-- Replace the old perk-only unique constraint with partial unique indexes.
alter table public.tier_list_entries drop constraint if exists tier_list_entries_tier_list_id_perk_id_key;

create index if not exists tier_list_entries_list_idx
  on public.tier_list_entries (tier_list_id, tier, position);
-- One row per concrete target per list (custom entries are not constrained).
create unique index if not exists tier_list_entries_perk_uniq
  on public.tier_list_entries (tier_list_id, perk_id) where perk_id is not null;
create unique index if not exists tier_list_entries_character_uniq
  on public.tier_list_entries (tier_list_id, character_id) where character_id is not null;
create unique index if not exists tier_list_entries_map_uniq
  on public.tier_list_entries (tier_list_id, map_id) where map_id is not null;

-- Engagement on tier lists — mirrors the build_* engagement tables.
create table if not exists public.tier_list_likes (
  tier_list_id uuid not null references public.tier_lists (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (tier_list_id, user_id)
);
create index if not exists tier_list_likes_list_idx
  on public.tier_list_likes (tier_list_id);

create table if not exists public.tier_list_favorites (
  tier_list_id uuid not null references public.tier_lists (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (tier_list_id, user_id)
);
create index if not exists tier_list_favorites_user_idx
  on public.tier_list_favorites (user_id);

create table if not exists public.tier_list_comments (
  id           uuid primary key default gen_random_uuid(),
  tier_list_id uuid not null references public.tier_lists (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  deleted_at   timestamptz,
  deleted_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tier_list_comments_list_idx
  on public.tier_list_comments (tier_list_id, created_at);

-- ---------- Triggers (no auth context; authz lives in the app layer) ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Profiles: maintain updated_at + enforce the 30-day username-change cooldown.
-- (Role-change protection moved to the application layer. Admins are exempt
-- from the cooldown — admin accounts are not treated like normal users.)
create or replace function public.profiles_before_update()
returns trigger language plpgsql as $$
begin
  if new.username is distinct from old.username then
    if old.role <> 'admin'
       and new.username !~ '^deleted_'
       and old.last_username_change_at is not null
       and now() - old.last_username_change_at < interval '30 days' then
      raise exception 'Username can only be changed once every 30 days';
    end if;
    new.last_username_change_at := now();
  else
    new.last_username_change_at := old.last_username_change_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists builds_set_updated_at on public.builds;
create trigger builds_set_updated_at
  before update on public.builds
  for each row execute function public.set_updated_at();

drop trigger if exists build_editorials_set_updated_at on public.build_editorials;
create trigger build_editorials_set_updated_at
  before update on public.build_editorials
  for each row execute function public.set_updated_at();

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

drop trigger if exists build_comments_set_updated_at on public.build_comments;
create trigger build_comments_set_updated_at
  before update on public.build_comments
  for each row execute function public.set_updated_at();

drop trigger if exists tier_lists_set_updated_at on public.tier_lists;
create trigger tier_lists_set_updated_at
  before update on public.tier_lists
  for each row execute function public.set_updated_at();

drop trigger if exists tier_list_comments_set_updated_at on public.tier_list_comments;
create trigger tier_list_comments_set_updated_at
  before update on public.tier_list_comments
  for each row execute function public.set_updated_at();

-- Record a staff notification when a community build enters review.
create or replace function public.notify_build_submitted()
returns trigger language plpgsql as $$
begin
  if new.status = 'pending_review' then
    insert into public.notifications (type, build_id, actor_id, payload)
    values (
      'build_submitted', new.id, new.author_id,
      jsonb_build_object('title', new.title, 'role', new.role)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_build_submitted_after_insert on public.builds;
create trigger notify_build_submitted_after_insert
  after insert on public.builds
  for each row execute function public.notify_build_submitted();

-- ---------- Perk labels (admin-managed perk classification) ----------
-- Separate from build tags: build tags describe whole builds; perk labels
-- describe individual perks. Mirrors the tag tables' shape.
create table if not exists public.perk_label_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.perk_label_categories (name, slug, sort_order) values
  ('General', 'general', 1),
  ('Strength', 'strength', 2),
  ('Function', 'function', 3),
  ('Audience', 'audience', 4)
on conflict (slug) do nothing;

create table if not exists public.perk_labels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  category_id uuid references public.perk_label_categories (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists perk_labels_category_idx on public.perk_labels (category_id);
create index if not exists perk_labels_active_idx on public.perk_labels (is_active);

-- Seed default labels (admins can rename/disable/delete/recategorize later).
insert into public.perk_labels (name, slug, category_id)
select v.name, v.slug, c.id
from (values
  ('Meta', 'meta', 'strength'),
  ('Beginner Friendly', 'beginner-friendly', 'audience'),
  ('Solo Queue', 'solo-queue', 'audience'),
  ('Anti-Tunneling', 'anti-tunneling', 'function'),
  ('Endgame', 'endgame', 'function'),
  ('Chase', 'chase', 'function'),
  ('Slowdown', 'slowdown', 'function'),
  ('Aura Reading', 'aura-reading', 'function'),
  ('Stealth', 'stealth', 'function'),
  ('Looping', 'looping', 'function'),
  ('Gen Defense', 'gen-defense', 'function')
) as v(name, slug, cat)
join public.perk_label_categories c on c.slug = v.cat
on conflict (slug) do nothing;

create table if not exists public.perk_label_assignments (
  perk_id    uuid not null references public.perks (id) on delete cascade,
  label_id   uuid not null references public.perk_labels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perk_id, label_id)
);
create index if not exists perk_label_assignments_label_idx on public.perk_label_assignments (label_id);

-- ---------- Owned perks (per-user perk collection) ----------
-- A user marks which perks they own; build creation and the generator can
-- optionally restrict to this set. User-scoped and private.
create table if not exists public.user_owned_perks (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  perk_id    uuid not null references public.perks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, perk_id)
);
create index if not exists user_owned_perks_user_idx on public.user_owned_perks (user_id);
create index if not exists user_owned_perks_perk_idx on public.user_owned_perks (perk_id);

-- ======================================================================
-- Community Discussions / Threads (separate from build comments)
-- ======================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'discussion_status') then
    create type public.discussion_status as enum ('open', 'locked', 'archived');
  end if;
end $$;

create table if not exists public.discussion_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.discussion_categories (name, slug, description, sort_order) values
  ('General Discussion', 'general', 'Anything Dead by Daylight.', 1),
  ('Killer Discussion', 'killer', 'Killers, powers, and play.', 2),
  ('Survivor Discussion', 'survivor', 'Survivors and survival play.', 3),
  ('Builds & Strategies', 'builds-strategies', 'Loadouts and tactics.', 4),
  ('Perks', 'perks', 'Perk talk and theorycraft.', 5),
  ('Patch Discussion', 'patch', 'Updates, PTB, and balance changes.', 6),
  ('Beginner Help', 'beginner-help', 'New player questions and tips.', 7)
on conflict (slug) do nothing;

create table if not exists public.discussion_threads (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  category_id     uuid references public.discussion_categories (id) on delete set null,
  author_id       uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 160),
  body            text not null check (char_length(body) between 1 and 20000),
  status          public.discussion_status not null default 'open',
  -- Optional related references (Req 8). Killer/survivor are characters.
  perk_id         uuid references public.perks (id) on delete set null,
  character_id    uuid references public.characters (id) on delete set null,
  build_id        uuid references public.builds (id) on delete set null,
  reply_count     int not null default 0,
  last_activity_at timestamptz not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists discussion_threads_category_idx on public.discussion_threads (category_id);
create index if not exists discussion_threads_author_idx on public.discussion_threads (author_id);
create index if not exists discussion_threads_activity_idx on public.discussion_threads (last_activity_at desc);
create index if not exists discussion_threads_status_idx on public.discussion_threads (status);
create index if not exists discussion_threads_perk_idx on public.discussion_threads (perk_id);
create index if not exists discussion_threads_character_idx on public.discussion_threads (character_id);
create index if not exists discussion_threads_build_idx on public.discussion_threads (build_id);

create table if not exists public.discussion_replies (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.discussion_threads (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists discussion_replies_thread_idx on public.discussion_replies (thread_id, created_at);
create index if not exists discussion_replies_author_idx on public.discussion_replies (author_id);

-- Optional thread tags (separate from build tags and perk labels).
create table if not exists public.discussion_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.discussion_thread_tags (
  thread_id uuid not null references public.discussion_threads (id) on delete cascade,
  tag_id    uuid not null references public.discussion_tags (id) on delete cascade,
  primary key (thread_id, tag_id)
);
create index if not exists discussion_thread_tags_tag_idx on public.discussion_thread_tags (tag_id);

-- Votes: one row per user per target, value +1 or -1.
create table if not exists public.discussion_thread_votes (
  thread_id  uuid not null references public.discussion_threads (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.discussion_reply_votes (
  reply_id   uuid not null references public.discussion_replies (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

-- Reports for threads and replies (target_type discriminates).
create table if not exists public.discussion_reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('thread', 'reply')),
  target_id   uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 1000),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists discussion_reports_open_idx on public.discussion_reports (resolved_at);
create index if not exists discussion_reports_target_idx on public.discussion_reports (target_type, target_id);

-- ------------------------------------------------------------------
-- Audit log (append-only). Records staff/moderation actions: approvals,
-- rejections, deletions, restores, status changes, asset review decisions,
-- and other admin actions. metadata holds action-specific context.
-- ------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_action_idx on public.audit_log (action);

-- ------------------------------------------------------------------
-- Email tokens (hashed, single-use). Backs verification and the recovery /
-- restoration / deletion-confirmation flows. The raw token lives only in the
-- emailed link; the DB stores its hash, like sessions.
-- ------------------------------------------------------------------
create table if not exists public.email_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  purpose    text not null check (purpose in
              ('verify', 'password_reset', 'delete_confirm', 'restore')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_tokens_user_idx on public.email_tokens (user_id, purpose);
create index if not exists email_tokens_expires_idx on public.email_tokens (expires_at);

-- ------------------------------------------------------------------
-- Build version history. An append-only timeline of a build's applied content:
-- creation, approved revisions, and direct staff edits. content is a snapshot in
-- the BuildRevisionContent shape.
-- ------------------------------------------------------------------
create table if not exists public.build_versions (
  id         uuid primary key default gen_random_uuid(),
  build_id   uuid not null references public.builds (id) on delete cascade,
  version_no int not null,
  kind       text not null check (kind in ('created', 'revision', 'staff_edit')),
  content    jsonb not null default '{}'::jsonb,
  author_id  uuid references public.profiles (id) on delete set null,
  note       text,
  created_at timestamptz not null default now(),
  unique (build_id, version_no)
);
create index if not exists build_versions_build_idx
  on public.build_versions (build_id, version_no desc);
