import "server-only";

import { sql } from "kysely";

import { db } from "@/lib/db/kysely";
import type { BuildRevisionContent } from "@/types/database";

export type BuildVersionKind = "created" | "revision" | "staff_edit";

/**
 * Append a version entry for a build. Best-effort: a failure here must not break
 * the surrounding approval/edit. version_no is the build's current max + 1.
 */
export async function recordBuildVersion(input: {
  buildId: string;
  kind: BuildVersionKind;
  content: BuildRevisionContent;
  authorId: string | null;
  note?: string | null;
}): Promise<void> {
  try {
    const last = await db
      .selectFrom("build_versions")
      .select("version_no")
      .where("build_id", "=", input.buildId)
      .orderBy("version_no", "desc")
      .limit(1)
      .executeTakeFirst();
    const versionNo = (last?.version_no ?? 0) + 1;
    await db
      .insertInto("build_versions")
      .values({
        build_id: input.buildId,
        version_no: versionNo,
        kind: input.kind,
        content: sql`${JSON.stringify(input.content)}::jsonb`,
        author_id: input.authorId,
        note: input.note ?? null,
      })
      .execute();
  } catch {
    // Best-effort history; never block the underlying operation.
  }
}

export type BuildVersionItem = {
  id: string;
  versionNo: number;
  kind: string;
  authorName: string | null;
  note: string | null;
  createdAt: string;
};

export async function listBuildVersions(
  buildId: string,
): Promise<BuildVersionItem[]> {
  const rows = await db
    .selectFrom("build_versions as v")
    .leftJoin("profiles as p", "p.id", "v.author_id")
    .select([
      "v.id as id",
      "v.version_no as versionNo",
      "v.kind as kind",
      "v.note as note",
      "v.created_at as createdAt",
      "p.username as authorUsername",
      "p.display_name as authorDisplay",
    ])
    .where("v.build_id", "=", buildId)
    .orderBy("v.version_no", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    versionNo: r.versionNo,
    kind: r.kind,
    authorName: r.authorDisplay ?? r.authorUsername ?? null,
    note: r.note,
    createdAt: r.createdAt,
  }));
}
