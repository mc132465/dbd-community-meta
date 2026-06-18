/**
 * Edge-safe constants for the local session cookie. No Node/DB imports here so
 * this can be imported by middleware (Edge runtime) as well as server code.
 */
export const SESSION_COOKIE = "dbd_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
