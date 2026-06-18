# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for an
exploitable vulnerability. Use GitHub's "Report a vulnerability" (Security Advisories) on
this repository, or contact the maintainer directly. Include reproduction steps and the
affected version. We aim to acknowledge reports promptly and will coordinate a fix and
disclosure timeline with you.

## Supported versions

This project is pre-1.0 and under active development. Only the latest `*-dev` version
(see [`VERSION`](VERSION)) receives fixes.

## Operator security checklist

Because this is self-hosted, the security of a deployment is largely up to the operator:

- **Secrets:** set a strong, unique `POSTGRES_PASSWORD` and a random `SESSION_SECRET`
  (`openssl rand -hex 32`). Change `LOCAL_ADMIN_PASSWORD` before first boot, or rotate the
  admin password immediately after.
- **Never commit `.env`.** It is gitignored; only `.env.example` (placeholders) is
  tracked. If a real `.env` was ever committed, purge it from git history and rotate the
  exposed values.
- **Cookies:** set `SESSION_COOKIE_SECURE=true` only behind HTTPS/TLS. On plain HTTP keep
  it `false` (browsers drop Secure cookies over HTTP, breaking login).
- **Database:** Postgres is not published to the host by default in `docker-compose.yml`.
  Keep it that way unless you need external access, and firewall it if you do.
- **Reverse proxy:** terminate TLS at a proxy (e.g. Caddy/Nginx) for production and
  forward to the app on port 3000.

## What's implemented

- Passwords are hashed with **argon2id**; sessions are opaque random tokens stored
  **hashed** in the database (the cookie holds only the raw token).
- Suspended/banned/archived users are blocked at login and treated as logged out.
- Admin/staff actions are gated by role checks, and key moderation actions are recorded
  in an append-only audit log.

Email-based account recovery is **not yet implemented** (planned). Until then, admin
password resets are done via `pnpm db:seed`/database access.
