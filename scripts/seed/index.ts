/**
 * Local admin seeder (Path B). Creates an admin account directly in the local
 * Postgres schema (users + profiles), idempotent. Uses a plain pg Pool + argon2
 * inline rather than the app's server-only modules (which can't be imported from
 * a tsx script).
 *
 *   pnpm db:seed   # default admin / admin12345 (override via env)
 */
import dotenv from "dotenv";
import argon2 from "argon2";
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

const ADMIN_USERNAME = (process.env.LOCAL_ADMIN_USERNAME ?? "admin")
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = process.env.LOCAL_ADMIN_PASSWORD ?? "admin12345";

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const existing = await client.query(
      "select id, role from public.profiles where username = $1",
      [ADMIN_USERNAME],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].role !== "admin") {
        await client.query(
          "update public.profiles set role = 'admin' where id = $1",
          [existing.rows[0].id],
        );
      }
      console.log(`Admin already present: @${ADMIN_USERNAME} (role ensured = admin)`);
      return;
    }

    const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
      type: argon2.argon2id,
    });

    await client.query("begin");
    const user = await client.query(
      "insert into public.users (password_hash) values ($1) returning id",
      [passwordHash],
    );
    const id = user.rows[0].id as string;
    await client.query(
      "insert into public.profiles (id, username, role) values ($1, $2, 'admin')",
      [id, ADMIN_USERNAME],
    );
    await client.query("commit");

    console.log(
      `\nLocal admin created:\n  username: ${ADMIN_USERNAME}\n  password: ${ADMIN_PASSWORD}\n` +
        "  (override with LOCAL_ADMIN_USERNAME / LOCAL_ADMIN_PASSWORD)\n",
    );
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
