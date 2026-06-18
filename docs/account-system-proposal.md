# Account System — Design Proposal (lifecycle + email)

Status: **proposal only, nothing implemented.** Covers (1) user archive → delete/
anonymize and (2) email-required accounts. Grounded in the current schema.

---

## 0. Current state (from the code)
- `users` = `id, password_hash, created_at, updated_at`. **No email, no status.**
- `profiles` = same `id` as users (1:1), `username` (unique, `^[a-z0-9_]{3,20}$`),
  `display_name, avatar_url, bio, role, is_public, playstyle_tags, …`.
- `sessions` = DB sessions, `on delete cascade` from users.
- Login is **username + password (argon2id)**. No email anywhere.
- **Ownership FKs:** authored content references `profiles(id)`:
  - `ON DELETE CASCADE`: builds.author_id, discussion_threads.author_id,
    discussion_replies.author_id, build comments.author_id, votes (thread/reply/build),
    favorites/likes, owned perks, reports.reporter_id.
  - `ON DELETE SET NULL`: build_revisions.reviewed_by, editor_id, audit_log.actor_id,
    perk_recommendations.created_by, *_deleted_by, reports.resolved_by.

**Implication:** deleting a profile row cascade-deletes all the user's builds,
threads, replies, comments, and votes. We must NOT hard-delete to anonymize.

---

## 1. Core design decision — two deletion modes

Both reachable only from the **archived** state. Tombstone is the default/safe action;
hard delete is an admin-only advanced action behind an extra confirmation.

### 1a. Tombstone / anonymize — DEFAULT (recommended, safe)
Keep the `users`/`profiles` row and blank it in place:
- Overwrite PII: `username → deleted_<8hex>` (**frees the original username**),
  `display_name → "[deleted]"`, `avatar_url → null`, `bio → null`, `email → null`,
  `password_hash →` random/unusable.
- Set `status = 'deleted'`, `deleted_at = now()`; delete sessions + email tokens; clear opt-ins.
- **All authored content stays attached** — builds, comments, discussions, tier lists
  never break; links and community history are preserved; the author just shows "[deleted]".
- No identity bleed: a new account taking the freed username is a different row; old
  content remains under the tombstone.

Avoids cascade loss and per-user unique-constraint collisions. We never `DELETE` the row
here — only lifecycle columns + PII change. Audit action: `user.anonymize`.

### 1b. Hard delete — ADMIN-ONLY ADVANCED (destructive, gated)
Permanently remove the account **and all associated content**. Implemented as a real
`DELETE` on the `users` row, which cascades through every `ON DELETE CASCADE` FK:
profiles, sessions, builds, discussion threads/replies, comments, votes, favorites,
owned perks, reports. `SET NULL` references (audit_log.actor_id, reviewed_by, editor_id,
deleted_by, recommendations.created_by) are nulled, so the rest of the site stays intact.
- **Intended for spam, bots, abuse, or test accounts** — cases where the content should
  also disappear. This is the one place we accept that links/history to that user break.
- The username is freed (the row is gone).
- Requires a **strong warning + a second confirmation step** (type the username to
  confirm) and is **admin-only** — never available via self-service.
- The audit entry (`user.hard_delete`, with username/id in metadata) is written
  **before** the delete so the action is recorded even though the row disappears.

---

## 2. Account lifecycle (states + transitions)

```
                         ┌─tombstone delete─▶ deleted (row kept, anonymized) [terminal]
active ──archive──▶ archived ┤
   ▲                   │     └─hard delete (gated)─▶ (row removed, content cascaded) [gone]
   └─────restore───────┘
```

- **active** — normal.
- **archived** — reversible deactivation: login blocked, sessions revoked, public
  profile hidden. Content remains. Username still reserved. Appears in the admin
  **Archive** area. The only state from which deletion can occur.
- **deleted (tombstone)** — anonymized per §1a. Row kept, terminal, username freed.
- **hard-deleted** — row and all cascaded content removed per §1b. Not a stored state
  (nothing remains); recorded only in the audit log.

All transitions write an `audit_log` entry (actor = admin, or the user for self-service).

---

## 3. Schema changes — lifecycle (additive)

```sql
-- users
alter table users add column if not exists status text not null default 'active'
  check (status in ('active','archived','deleted'));
alter table users add column if not exists archived_at  timestamptz;
alter table users add column if not exists deleted_at    timestamptz;
alter table users add column if not exists archived_by   uuid references profiles(id) on delete set null;

-- profiles (mirror status for cheap public-facing checks/joins)
alter table profiles add column if not exists status text not null default 'active'
  check (status in ('active','archived','deleted'));
create index if not exists profiles_status_idx on profiles (status);
```

Reserved-username guard: signup rejects names matching `^deleted_` (so a freed
tombstone name can't be re-taken by a real user, and the pattern stays unambiguous).

---

## 4. Schema changes — email (additive)

```sql
-- users: email + verification
alter table users add column if not exists email text;                 -- nullable for grandfathering
alter table users add column if not exists email_verified_at timestamptz;
-- case-insensitive uniqueness via a functional unique index on lower(email)
create unique index if not exists users_email_lower_key
  on users (lower(email)) where email is not null;

-- one-time email tokens (verify / reset / delete-confirm / restore)
create table if not exists email_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  purpose    text not null check (purpose in
              ('verify','password_reset','delete_confirm','restore')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_tokens_user_idx on email_tokens (user_id, purpose);

-- opt-in communication preferences (transactional mail is always allowed)
alter table profiles add column if not exists email_opt_newsletter boolean not null default false;
alter table profiles add column if not exists email_opt_events     boolean not null default false;
```

Notes: tokens stored hashed (like sessions). `email` lowercased on write; uniqueness is
on `lower(email)` and only enforced when non-null (so many tombstones with null email are fine).

---

## 5. Behavior

**Login / session gating.** Auth resolves the user, then checks `status`: `archived` →
refuse with a clear message ("account deactivated — contact an admin / restore"),
`deleted` → treat as not-found. Archived/deleted users' sessions are revoked at transition.

**Email required (new accounts).** Signup requires a valid, unique email + sends a
verification token. The account is usable immediately but shows an "unverified email"
banner; certain actions (e.g., posting) can optionally be gated until verified (Q4).

**Grandfathering (existing accounts).** `email` stays null for them. On next login they
see a one-time prompt to add + verify an email, with a note that **account recovery
requires an email on file**. We don't lock them out; we nag. (Optional hard deadline = Q5.)

**Anonymize / tombstone (default).** From the archive: `status='deleted', deleted_at=now()`,
`username='deleted_'+id8`, `display_name='[deleted]'`, `avatar_url=null, bio=null`,
`users.email=null, email_verified_at=null`, `password_hash=<random>`, delete sessions +
email_tokens, reset opt-in flags. Content FKs untouched. Audit `user.anonymize`.

**Hard delete (admin-only, gated).** From the archive, behind a typed confirmation: write
the audit entry `user.hard_delete` first (metadata: username + id), then `DELETE` the
`users` row. Cascade removes profiles, sessions, and all authored content; `SET NULL`
refs are nulled. The username is freed because the row no longer exists.

**Username reuse.** Freed immediately after anonymize (original name no longer held).

---

## 6. Admin UI

- **Users list** — add a status column + filter (active / archived / deleted). Row
  actions: **Archive** (active→archived), **Restore** (archived→active).
- **Archive area** (`/admin/users/archived`) — lists archived users with archived date +
  who archived them. Three actions, ordered safest-first:
  - **Restore** → back to active.
  - **Tombstone delete** (default, primary button) → anonymize per §1a; single confirm.
  - **Hard delete** (advanced, danger-styled, admin-only) → §1b; requires a **second
    confirmation** where the admin types the exact username, plus a strong warning that
    this permanently removes the account and all its content.
- **Deleted** — tombstones are listed read-only (for audit), not restorable. Hard-deleted
  accounts exist only as audit-log entries.
- **Audit log** — new actions: `user.archive`, `user.restore`, `user.anonymize`,
  `user.hard_delete` (viewer already exists from 1.8.0).
- (Later) an **Email** panel: verification stats + newsletter opt-in counts.

---

## 7. User-facing flow

- **Signup:** username + email + password → create (unverified) → send verify email →
  land logged-in with a "verify your email" banner.
- **Verify:** link with token → `email_verified_at = now()`.
- **Account settings:** add/change email (re-verify), toggle **opt-in** newsletter /
  event reminders (default off), change password, **request account deletion**.
- **Self-service deletion:** request → email `delete_confirm` link → on confirm, account
  goes **archived** (pending) + audit; **admins finalize** with a **tombstone** delete from
  the archive (matches "admins delete from archive"). Hard delete is **never** self-service.
  Optional auto-tombstone after N days (Q6).
- **Password reset / restore:** email token flows (`password_reset`, `restore`).

---

## 8. Email transport (infra)

Sending email needs a transport. Proposal: **nodemailer over SMTP**, configured by env
(`SMTP_HOST/PORT/USER/PASS/FROM`); in dev or when unset, a **console/log transport** that
prints the link instead of sending (so flows work without a mail server). This is the one
new runtime dependency; everything else is additive schema + app code. Transactional mail
(verify, reset, delete-confirm, restore) is always sent; newsletters/reminders only to
opted-in addresses.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Hard delete cascades away public content | In-place anonymization; never `DELETE` the row |
| Reassigning content to a ghost collides with unique votes/likes | Tombstone keeps original row; no reassignment |
| Freed username pattern collides / is re-registered | Reserve `^deleted_` from signup; tombstone name is unique by id |
| Grandfathered users can't recover (no email) | Nag prompt + clear warning; optional deadline (Q5) |
| Email uniqueness case/whitespace | Store lowercased; unique index on `lower(email)` where not null |
| No SMTP configured | Dev/log transport fallback; flows still complete |
| Hard delete cascades away content (by design) | Admin-only + typed second confirmation + strong warning + audit-before-delete; default action is tombstone |
| Accidental/self-service deletion | Email confirmation + archived (reversible); self-service can only tombstone, never hard delete |
| Archived user's content visibility ambiguity | Decision Q2 (hide vs keep visible) |
| Sessions outliving a state change | Revoke sessions on archive/anonymize |

---

## 10. Recommended implementation order (phases — each additive & shippable)

1. **Lifecycle schema** (§3) + types. *(stop/approve — schema)*
2. **Archive / restore** + admin Users status + Archive area + login gating + audit.
   (Reversible, no email needed — lowest risk, immediately useful.)
3. **Permanent deletion** from the archive: **tombstone** (default, in-place blanking +
   username free) **and** admin-only **hard delete** (typed confirmation → cascade) + audit.
4. **Email schema** (§4) + types. *(stop/approve — schema)*
5. **Email transport** (SMTP + dev log) + **signup requires email** + verification +
   grandfather nag for existing users.
6. **Password reset**, **self-service deletion confirmation**, **restoration** (token flows).
7. **Opt-in preferences** storage + settings toggles (newsletter/events). Actual sending
   of newsletters/notifications deferred to a later feature.

Phases 1–3 (lifecycle) can ship before any email work; 4–7 layer email on top.

---

## 11. Decisions I need from you
- **Q1.** ~~Anonymization model~~ **RESOLVED:** support both — tombstone (default/safe)
  + admin-only hard delete with a second confirmation.
- **Q2.** When a user is **archived**, should their public content stay **visible**
  (attributed to a hidden account) or be **hidden** until restored? When **deleted**,
  content stays visible as "[deleted]" — confirm that's right.
- **Q3.** Login: keep **username + password** (email only for recovery/notify), or also
  allow **email login**?
- **Q4.** Should **unverified** new users be allowed to post immediately, or read-only
  until verified?
- **Q5.** Grandfathered users — **soft nag** indefinitely, or a **deadline** after which
  email is required to continue?
- **Q6.** Self-service deletion — **admin finalizes** only, or **auto-anonymize after N
  days** in archive (e.g. 30)?
- **Q7.** OK to add **nodemailer + SMTP env** (with a dev log fallback) as the mail
  transport?

Tell me your answers (or "your recommendation" for any) and I'll start at Phase 1.
