import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import {
  buildBackup,
  normalizeScope,
} from "@/lib/services/backup.service";

// Route handlers aren't wrapped by the admin layout, so the staff check is done
// here. Per-request (reads the session cookie); never cached.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const scope = normalizeScope(new URL(request.url).searchParams.get("scope"));
  const envelope = await buildBackup(scope);
  const json = JSON.stringify(envelope, null, 2);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `fog-archives-backup-${scope}-${date}.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
