/**
 * Hand-written database types.
 *
 * Hand-maintained types for the local PostgreSQL schema (db/schema.sql).
 *   Keep these in sync with the schema; the Kysely DB interface lives in
 *   src/lib/db/types.ts.
 *
 * Until then, this covers the tables and enums built through Phase 1.
 */

export type UserRole = "user" | "moderator" | "admin";
export type GameRole = "killer" | "survivor";
export type AddonRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "very_rare"
  | "ultra_rare"
  | "event";
export type AddonTarget = "killer_power" | "item";
export type BuildDifficulty = "beginner" | "intermediate" | "advanced";
export type BuildStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";
export type NotificationType = "build_submitted";

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  is_public: boolean;
  playstyle_tags: string[];
  email_opt_newsletter: boolean;
  email_opt_events: boolean;
  last_username_change_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfilePickKind = "fav_killer" | "hated_killer";

export interface ProfilePickRow {
  profile_id: string;
  kind: ProfilePickKind;
  character_id: string | null;
  perk_id: string | null;
  rank: number;
  created_at: string;
}

export type RevisionStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "superseded";

/** User-editable build payload carried by a revision (no editorial, no slug). */
export interface BuildRevisionContent {
  title: string | null;
  role: GameRole;
  character_id: string;
  difficulty_suggestion: BuildDifficulty | null;
  item_id: string | null;
  perk_ids: string[];
  add_on_ids: string[];
  tag_ids: string[];
}

export interface BuildRevisionRow {
  id: string;
  build_id: string;
  author_id: string;
  status: RevisionStatus;
  content: BuildRevisionContent;
  base_snapshot: BuildRevisionContent | null;
  author_note: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Curated (killer character -> perk) recommendation. Killer-only in v1. */
export interface PerkRecommendationRow {
  id: string;
  character_id: string;
  perk_id: string;
  note: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Local auth credentials (Path B). Public profile data lives in ProfileRow. */
export type UserStatus = "active" | "suspended" | "banned";

export interface UserRow {
  id: string;
  password_hash: string;
  status: UserStatus;
  last_active_at: string | null;
  deleted_at: string | null;
  anonymized_at: string | null;
  email: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface PatchRow {
  id: string;
  version: string;
  name: string | null;
  released_at: string | null;
  notes: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface CharacterRow {
  id: string;
  role: GameRole;
  name: string;
  slug: string;
  title: string | null;
  lore: string | null;
  power_name: string | null;
  power_desc: string | null;
  image_url: string | null;
  home_realm: string | null;
  chapter: string | null;
  description: string | null;
  release_patch_id: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface PerkRow {
  id: string;
  role: GameRole | null;
  name: string;
  slug: string;
  description: string | null;
  noob_explanation: string | null;
  icon_url: string | null;
  origin_character_id: string | null;
  is_teachable: boolean;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface ItemRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  icon_url: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface AddOnRow {
  id: string;
  name: string;
  slug: string;
  rarity: AddonRarity;
  applies_to: AddonTarget | null;
  parent_character_id: string | null;
  parent_item_id: string | null;
  description: string | null;
  icon_url: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface MapRow {
  id: string;
  name: string;
  slug: string;
  realm: string | null;
  image_url: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface PowerRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  noob_explanation: string | null;
  icon_url: string | null;
  character_id: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface OfferingRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface StatusEffectRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface AssetPackRow {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export type AssetTypeKey =
  | "perks"
  | "items"
  | "add_ons"
  | "powers"
  | "offerings"
  | "status_effects"
  | "characters"
  | "maps";

export interface AssetPackImageRow {
  id: string;
  pack_id: string;
  asset_type: AssetTypeKey;
  asset_id: string;
  storage_path: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface BuildRow {
  id: string;
  author_id: string;
  title: string | null;
  slug: string;
  role: GameRole;
  character_id: string | null;
  difficulty_suggestion: BuildDifficulty | null;
  patch_id: string | null;
  status: BuildStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildPerkRow {
  build_id: string;
  perk_id: string;
  slot: number;
}

export interface BuildAddOnRow {
  build_id: string;
  add_on_id: string;
  slot: number;
}

export interface BuildItemRow {
  build_id: string;
  item_id: string;
}

export interface BuildEditorialRow {
  build_id: string;
  overall_strategy: string | null;
  strengths: string | null;
  weaknesses: string | null;
  recommended_difficulty: BuildDifficulty | null;
  is_featured: boolean;
  editor_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TagCategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface PerkLabelCategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface PerkLabelRow {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PerkLabelAssignmentRow {
  perk_id: string;
  label_id: string;
  created_at: string;
}

export interface UserOwnedPerkRow {
  user_id: string;
  perk_id: string;
  created_at: string;
}

export type DiscussionStatus = "open" | "locked" | "archived";

export interface DiscussionCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface DiscussionThreadRow {
  id: string;
  slug: string;
  category_id: string | null;
  author_id: string;
  title: string;
  body: string;
  status: DiscussionStatus;
  perk_id: string | null;
  character_id: string | null;
  build_id: string | null;
  reply_count: number;
  last_activity_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscussionReplyRow {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscussionTagRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export interface DiscussionThreadTagRow {
  thread_id: string;
  tag_id: string;
}

export interface DiscussionThreadVoteRow {
  thread_id: string;
  user_id: string;
  value: number;
  created_at: string;
}

export interface DiscussionReplyVoteRow {
  reply_id: string;
  user_id: string;
  value: number;
  created_at: string;
}

export interface DiscussionReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reporter_id: string;
  reason: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuildTagRow {
  build_id: string;
  tag_id: string;
}

export interface BuildEditorialTagRow {
  build_id: string;
  tag_id: string;
}

export interface BuildPerkExplanationRow {
  build_id: string;
  slot: number;
  reason: string;
  editor_id: string | null;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  build_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
}

type TableShape<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<
        ProfileRow,
        {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: UserRole;
          last_username_change_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      patches: TableShape<PatchRow>;
      characters: TableShape<CharacterRow>;
      perks: TableShape<PerkRow>;
      items: TableShape<ItemRow>;
      add_ons: TableShape<AddOnRow>;
      maps: TableShape<MapRow>;
      powers: TableShape<PowerRow>;
      offerings: TableShape<OfferingRow>;
      status_effects: TableShape<StatusEffectRow>;
      asset_packs: TableShape<AssetPackRow>;
      asset_pack_images: TableShape<AssetPackImageRow>;
      builds: TableShape<BuildRow>;
      build_perks: TableShape<BuildPerkRow>;
      build_add_ons: TableShape<BuildAddOnRow>;
      build_item: TableShape<BuildItemRow>;
      build_editorials: TableShape<BuildEditorialRow>;
      build_perk_explanations: TableShape<BuildPerkExplanationRow>;
      notifications: TableShape<NotificationRow>;
      tag_categories: TableShape<TagCategoryRow>;
      tags: TableShape<TagRow>;
      build_tags: TableShape<BuildTagRow>;
      build_editorial_tags: TableShape<BuildEditorialTagRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      game_role: GameRole;
      addon_rarity: AddonRarity;
      addon_target: AddonTarget;
      build_difficulty: BuildDifficulty;
      build_status: BuildStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export interface BuildLikeRow {
  build_id: string;
  user_id: string;
  created_at: string;
}

export interface BuildFavoriteRow {
  build_id: string;
  user_id: string;
  created_at: string;
}

export interface BuildCommentRow {
  id: string;
  build_id: string;
  author_id: string;
  body: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Tier lists (Phase 4) ----------
export type TierRank = "S" | "A" | "B" | "C" | "D" | "F";
export type TierListStatus = "draft" | "published" | "archived";

export interface TierListRow {
  id: string;
  author_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  is_official: boolean;
  source: string | null;
  status: TierListStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TierListEntryRow {
  id: string;
  tier_list_id: string;
  perk_id: string;
  tier: TierRank;
  position: number;
  created_at: string;
}

export interface TierListLikeRow {
  tier_list_id: string;
  user_id: string;
  created_at: string;
}

export interface TierListFavoriteRow {
  tier_list_id: string;
  user_id: string;
  created_at: string;
}

export interface TierListCommentRow {
  id: string;
  tier_list_id: string;
  author_id: string;
  body: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
