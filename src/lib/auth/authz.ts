import "server-only";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator, type UserRole } from "@/lib/auth/roles";

export type Viewer = {
  userId: string | null;
  role: UserRole | null;
  isStaff: boolean;
};

/**
 * Resolves the current viewer's identity + role. With RLS gone (Path B),
 * authorization is enforced explicitly in services/actions using this.
 */
export async function getViewer(): Promise<Viewer> {
  const profile = await getCurrentProfile();
  return {
    userId: profile?.id ?? null,
    role: profile?.role ?? null,
    isStaff: isModerator(profile?.role),
  };
}

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For mutations: returns the viewer or throws if not signed in. */
export async function requireUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.userId) throw new AuthorizationError("You must be signed in.");
  return viewer;
}

/** For staff mutations: returns the viewer or throws if not moderator/admin. */
export async function requireStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isStaff) throw new AuthorizationError("Staff only.");
  return viewer;
}
