export const USER_ROLES = ["user", "moderator", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Higher number = more privilege. */
const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

/** True when `role` meets or exceeds `required`. */
export function isAtLeast(role: UserRole, required: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

export function isModerator(role: UserRole | null | undefined): boolean {
  return role === "moderator" || role === "admin";
}
