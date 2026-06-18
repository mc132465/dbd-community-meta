/**
 * Local Postgres migration runner — applies db/schema.sql (the single source of
 * truth) to DATABASE_URL. The schema is idempotent, so this is safe to re-run.
 *
 *   pnpm db:migrate          apply db/schema.sql
 *   pnpm db:reset            drop + recreate the public schema, then apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "Missing DATABASE_URL in .env.local, e.g.\n" +
      "  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dbd",
  );
  process.exit(1);
}

const reset = process.argv.includes("--reset");

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    if (reset) {
      await client.query("drop schema if exists public cascade; create schema public;");
      console.log("• Dropped and recreated schema public");
    }
    const sql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf-8");
    await client.query(sql);
    console.log("✓ Applied db/schema.sql");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:\n", err);
  process.exit(1);
});
