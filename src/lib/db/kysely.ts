import "server-only";

import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { DB } from "./types";

/**
 * Singleton Kysely client over a pg pool (Path B — local PostgreSQL).
 * Reused across requests in dev via a global to avoid exhausting connections on
 * hot reload. Configure DATABASE_URL in .env.local.
 */
declare global {
  // eslint-disable-next-line no-var
  var __dbdPool: Pool | undefined;
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (see .env.local).");
  }
  if (!global.__dbdPool) {
    global.__dbdPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global.__dbdPool;
}

export const db = new Kysely<DB>({
  // Lazy pool: created on first query (runtime), NOT at import. This lets
  // `next build` import modules without DATABASE_URL being set.
  dialect: new PostgresDialect({ pool: async () => getPool() }),
});
