import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { requireStaff } from "@/lib/auth/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A `.zip` filename with no path separators or traversal. */
function safeZip(value: string): string | null {
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    return null;
  }
  return /^[a-z0-9][a-z0-9_.-]{0,80}\.zip$/i.test(value) ? value : null;
}

/**
 * Stream an uploaded ZIP to data/assets/<name>.zip. The body is the raw file
 * bytes (sent with `?name=<filename>`), streamed to disk so large packs don't
 * load into memory. Staff-only. After upload the pack appears in Admin → Import.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    await requireStaff();
  } catch {
    return Response.json({ ok: false, error: "Staff only." }, { status: 403 });
  }

  const name = safeZip(new URL(req.url).searchParams.get("name") ?? "");
  if (!name) {
    return Response.json(
      { ok: false, error: "Invalid file name (.zip only)." },
      { status: 400 },
    );
  }
  if (!req.body) {
    return Response.json({ ok: false, error: "No file body." }, { status: 400 });
  }

  const dir = join(process.cwd(), "data/assets");
  await mkdir(dir, { recursive: true });
  const dest = join(dir, name);

  try {
    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- web→node stream bridge
      const nodeStream = Readable.fromWeb(req.body as any);
      const out = createWriteStream(dest);
      nodeStream.pipe(out);
      out.on("finish", () => resolve());
      out.on("error", reject);
      nodeStream.on("error", reject);
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: `Upload failed: ${String(err)}` },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, name });
}
