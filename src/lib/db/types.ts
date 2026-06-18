/**
 * Kysely table interface for the local Postgres schema (db/schema.sql).
 * Row types are reused from src/types/database.ts. Insert/Update refinements
 * (Generated<> for defaulted columns) will be added when services are ported in
 * Phase B2; for now these map table name → row shape for typed queries.
 */
import type { ColumnType, Generated } from "kysely";

import type {
  AddOnRow,
  BuildAddOnRow,
  BuildDifficulty,
  BuildEditorialTagRow,
  BuildItemRow,
  BuildPerkRow,
  BuildRevisionContent,
  BuildStatus,
  BuildTagRow,
  CharacterRow,
  GameRole,
  ItemRow,
  MapRow,
  NotificationRow,
  OfferingRow,
  PatchRow,
  PowerRow,
  StatusEffectRow,
  UserRole,
  TierListStatus,
} from "@/types/database";

/** Nullable column with no DB default: optional on insert, settable on update. */
type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;

// Auth tables get Kysely column helpers so DB-defaulted columns are optional on
// insert (these three are written via Kysely in B1).
interface UsersTable {
  id: Generated<string>;
  password_hash: string;
  status: Generated<string>;
  last_active_at: Nullable<string>;
  deleted_at: Nullable<string>;
  anonymized_at: Nullable<string>;
  email: Nullable<string>;
  email_verified_at: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface ProfilesTable {
  id: string; // = users.id (provided, not generated)
  username: string;
  display_name: Nullable<string>;
  avatar_url: Nullable<string>;
  bio: Nullable<string>;
  role: Generated<UserRole>;
  is_public: Generated<boolean>;
  playstyle_tags: Generated<string[]>;
  email_opt_newsletter: Generated<boolean>;
  email_opt_events: Generated<boolean>;
  last_username_change_at: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface ProfilePicksTable {
  profile_id: string;
  kind: string;
  character_id: Nullable<string>;
  perk_id: Nullable<string>;
  rank: Generated<number>;
  created_at: Generated<string>;
}

interface BuildRevisionsTable {
  id: Generated<string>;
  build_id: string;
  author_id: string;
  status: Generated<string>;
  content: BuildRevisionContent;
  base_snapshot: Nullable<BuildRevisionContent>;
  author_note: Nullable<string>;
  review_note: Nullable<string>;
  reviewed_by: Nullable<string>;
  reviewed_at: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface PerkRecommendationsTable {
  id: Generated<string>;
  character_id: string;
  perk_id: string;
  note: Nullable<string>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  created_by: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: Generated<string>;
}

// Builds + editorial tables are written via Kysely in B2.
interface BuildsTable {
  id: Generated<string>;
  author_id: string;
  title: Nullable<string>;
  slug: string;
  role: GameRole;
  character_id: Nullable<string>;
  difficulty_suggestion: Nullable<BuildDifficulty>;
  patch_id: Nullable<string>;
  status: Generated<BuildStatus>;
  reviewed_by: Nullable<string>;
  reviewed_at: Nullable<string>;
  review_note: Nullable<string>;
  deleted_at: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface BuildEditorialsTable {
  build_id: string;
  overall_strategy: Nullable<string>;
  strengths: Nullable<string>;
  weaknesses: Nullable<string>;
  recommended_difficulty: Nullable<BuildDifficulty>;
  is_featured: Generated<boolean>;
  editor_id: Nullable<string>;
  published_at: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface BuildPerkExplanationsTable {
  build_id: string;
  slot: number;
  reason: string;
  editor_id: Nullable<string>;
  updated_at: Generated<string>;
}

interface TagsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  category_id: Nullable<string>;
  is_active: Generated<boolean>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface TagCategoriesTable {
  id: Generated<string>;
  name: string;
  slug: string;
  sort_order: Generated<number>;
  created_at: Generated<string>;
}

// Perk labels (admin-managed perk classification; separate from build tags).
interface PerkLabelCategoriesTable {
  id: Generated<string>;
  name: string;
  slug: string;
  sort_order: Generated<number>;
  created_at: Generated<string>;
}

interface PerkLabelsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  category_id: Nullable<string>;
  is_active: Generated<boolean>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface PerkLabelAssignmentsTable {
  perk_id: string;
  label_id: string;
  created_at: Generated<string>;
}

interface SiteSettingsTable {
  key: string;
  value: string;
  updated_at: Generated<string>;
}

interface UserOwnedPerksTable {
  user_id: string;
  perk_id: string;
  created_at: Generated<string>;
}

// Insert-aware table type for perks (generated columns optional on insert).
interface PerksTable {
  id: Generated<string>;
  role: Nullable<GameRole>;
  name: string;
  slug: string;
  description: Nullable<string>;
  noob_explanation: Nullable<string>;
  icon_url: Nullable<string>;
  origin_character_id: Nullable<string>;
  is_teachable: Generated<boolean>;
  source: Nullable<string>;
  external_id: Nullable<string>;
  created_at: Generated<string>;
}

// Community discussions / threads.
type DiscussionStatus = "open" | "locked" | "archived";

interface DiscussionCategoriesTable {
  id: Generated<string>;
  name: string;
  slug: string;
  description: Nullable<string>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<string>;
}

interface DiscussionThreadsTable {
  id: Generated<string>;
  slug: string;
  category_id: Nullable<string>;
  author_id: string;
  title: string;
  body: string;
  status: Generated<DiscussionStatus>;
  perk_id: Nullable<string>;
  character_id: Nullable<string>;
  build_id: Nullable<string>;
  reply_count: Generated<number>;
  last_activity_at: Generated<string>;
  deleted_at: Nullable<string>;
  deleted_by: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface DiscussionRepliesTable {
  id: Generated<string>;
  thread_id: string;
  author_id: string;
  body: string;
  deleted_at: Nullable<string>;
  deleted_by: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface DiscussionTagsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  is_active: Generated<boolean>;
  created_at: Generated<string>;
}

interface DiscussionThreadTagsTable {
  thread_id: string;
  tag_id: string;
}

interface DiscussionThreadVotesTable {
  thread_id: string;
  user_id: string;
  value: number;
  created_at: Generated<string>;
}

interface DiscussionReplyVotesTable {
  reply_id: string;
  user_id: string;
  value: number;
  created_at: Generated<string>;
}

interface DiscussionReportsTable {
  id: Generated<string>;
  target_type: string;
  target_id: string;
  reporter_id: string;
  reason: string;
  resolved_at: Nullable<string>;
  resolved_by: Nullable<string>;
  created_at: Generated<string>;
}

// Community engagement (Phase 3).
interface BuildLikesTable {
  build_id: string;
  user_id: string;
  created_at: Generated<string>;
}

interface BuildFavoritesTable {
  build_id: string;
  user_id: string;
  created_at: Generated<string>;
}

interface BuildCommentsTable {
  id: Generated<string>;
  build_id: string;
  author_id: string;
  body: string;
  deleted_at: Nullable<string>;
  deleted_by: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

// Tier lists (Phase 4).
interface TierListsTable {
  id: Generated<string>;
  author_id: Nullable<string>;
  title: string;
  slug: string;
  description: Nullable<string>;
  category: Generated<string>;
  tier_labels: Generated<string[]>;
  is_official: Generated<boolean>;
  source: Nullable<string>;
  status: Generated<TierListStatus>;
  published_at: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface TierListEntriesTable {
  id: Generated<string>;
  tier_list_id: string;
  perk_id: Nullable<string>;
  character_id: Nullable<string>;
  map_id: Nullable<string>;
  target_type: Generated<string>;
  custom_label: Nullable<string>;
  tier: string;
  position: Generated<number>;
  created_at: Generated<string>;
}

interface TierListLikesTable {
  tier_list_id: string;
  user_id: string;
  created_at: Generated<string>;
}

interface TierListFavoritesTable {
  tier_list_id: string;
  user_id: string;
  created_at: Generated<string>;
}

interface TierListCommentsTable {
  id: Generated<string>;
  tier_list_id: string;
  author_id: string;
  body: string;
  deleted_at: Nullable<string>;
  deleted_by: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface AssetPacksTable {
  id: Generated<string>;
  name: string;
  slug: string;
  description: Nullable<string>;
  source_folder: Nullable<string>;
  is_default: Generated<boolean>;
  is_active: Generated<boolean>;
  created_at: Generated<string>;
}

interface AssetPackImagesTable {
  id: Generated<string>;
  pack_id: string;
  asset_type: string;
  asset_id: Nullable<string>;
  source_file: Generated<string>;
  derived_slug: Nullable<string>;
  mapping_mode: Generated<string>;
  storage_path: string;
  image_url: string;
  confidence: Nullable<number>;
  suggested_asset_id: Nullable<string>;
  review_status: Nullable<string>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface AuditLogTable {
  id: Generated<string>;
  actor_id: Nullable<string>;
  action: string;
  entity_type: string;
  entity_id: Nullable<string>;
  metadata: Generated<Record<string, unknown>>;
  created_at: Generated<string>;
}

interface BuildVersionsTable {
  id: Generated<string>;
  build_id: string;
  version_no: number;
  kind: string;
  content: Generated<Record<string, unknown>>;
  author_id: Nullable<string>;
  note: Nullable<string>;
  created_at: Generated<string>;
}

interface EmailTokensTable {
  id: Generated<string>;
  user_id: string;
  purpose: string;
  token_hash: string;
  expires_at: string;
  used_at: Nullable<string>;
  created_at: Generated<string>;
}

export interface DB {
  users: UsersTable;
  profiles: ProfilesTable;
  profile_picks: ProfilePicksTable;
  sessions: SessionsTable;
  patches: PatchRow;
  characters: CharacterRow;
  perks: PerksTable;
  items: ItemRow;
  add_ons: AddOnRow;
  maps: MapRow;
  powers: PowerRow;
  offerings: OfferingRow;
  status_effects: StatusEffectRow;
  asset_packs: AssetPacksTable;
  asset_pack_images: AssetPackImagesTable;
  audit_log: AuditLogTable;
  email_tokens: EmailTokensTable;
  build_versions: BuildVersionsTable;
  tag_categories: TagCategoriesTable;
  tags: TagsTable;
  perk_label_categories: PerkLabelCategoriesTable;
  perk_labels: PerkLabelsTable;
  perk_label_assignments: PerkLabelAssignmentsTable;
  user_owned_perks: UserOwnedPerksTable;
  site_settings: SiteSettingsTable;
  discussion_categories: DiscussionCategoriesTable;
  discussion_threads: DiscussionThreadsTable;
  discussion_replies: DiscussionRepliesTable;
  discussion_tags: DiscussionTagsTable;
  discussion_thread_tags: DiscussionThreadTagsTable;
  discussion_thread_votes: DiscussionThreadVotesTable;
  discussion_reply_votes: DiscussionReplyVotesTable;
  discussion_reports: DiscussionReportsTable;
  builds: BuildsTable;
  build_revisions: BuildRevisionsTable;
  perk_recommendations: PerkRecommendationsTable;
  build_perks: BuildPerkRow;
  build_add_ons: BuildAddOnRow;
  build_item: BuildItemRow;
  build_editorials: BuildEditorialsTable;
  build_perk_explanations: BuildPerkExplanationsTable;
  build_tags: BuildTagRow;
  build_editorial_tags: BuildEditorialTagRow;
  notifications: NotificationRow;
  build_likes: BuildLikesTable;
  build_favorites: BuildFavoritesTable;
  build_comments: BuildCommentsTable;
  tier_lists: TierListsTable;
  tier_list_entries: TierListEntriesTable;
  tier_list_likes: TierListLikesTable;
  tier_list_favorites: TierListFavoritesTable;
  tier_list_comments: TierListCommentsTable;
}
