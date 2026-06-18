/** Usernames are stored and compared lowercased and trimmed. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
