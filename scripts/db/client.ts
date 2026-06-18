import dotenv from "dotenv";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { DB } from "../../src/lib/db/types";

dotenv.config({ path: ".env.local" });

/**
 * A Kysely instance for tsx import scripts. Separate from src/lib/db/kysely.ts
 * because that module is marked "server-only" and can't be imported by scripts.
 * Call `await db.destroy()` when the script finishes.
 */
export function createDb(): Kysely<DB> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Missing DATABASE_URL in .env.local, e.g.\n" +
        "  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dbd",
    );
    process.exit(1);
  }
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: url }) }),
  });
}
