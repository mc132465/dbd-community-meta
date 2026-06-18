import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { isAdmin } from "@/lib/auth/roles";
import { listUsersForAdmin } from "@/lib/services/user-admin.service";
import {
  archiveUserAction,
  restoreUserAction,
  setUserStatusAction,
  tombstoneUserAction,
} from "./actions";
import { HardDeleteForm } from "@/components/admin/hard-delete-form";

export const metadata: Metadata = { title: "Users · Admin" };

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  suspended: "bg-amber-500/15 text-amber-400",
  banned: "bg-destructive/15 text-destructive",
};

const BTN =
  "rounded-md border border-border/60 px-2 py-1 text-xs hover:border-border disabled:opacity-50";

function StatusButton({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  return (
    <form action={setUserStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={BTN}>{label}</button>
    </form>
  );
}

export default async function AdminUsersPage() {
  const me = await getCurrentProfile();
  if (!me || !isAdmin(me.role)) {
    return (
      <p className="text-sm text-muted-foreground">
        User management is available to admins only.
      </p>
    );
  }

  const users = await listUsersForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Users
        </h2>
        <p className="text-sm text-muted-foreground">
          {users.length} total. Suspend or ban to block sign-in; archive to
          deactivate (reversible). From an archived account: <strong>Tombstone</strong>{" "}
          anonymizes it (frees the username, keeps public content as “[deleted]”), or{" "}
          <strong>Hard delete</strong> permanently removes the account and all its
          content (typed confirmation required). All actions are recorded in the audit log.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Last active</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me.id;
              const anonymized = u.anonymizedAt !== null;
              const archived = u.deletedAt !== null;
              return (
                <tr key={u.id} className="border-t border-border/60 align-middle">
                  <td className="px-4 py-2">
                    <span className="font-medium">@{u.username}</span>
                    {u.displayName ? (
                      <span className="ml-2 text-muted-foreground">
                        {u.displayName}
                      </span>
                    ) : null}
                    {anonymized ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Deleted
                      </span>
                    ) : archived ? (
                      <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-xs text-destructive">
                        Archived
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">
                    {u.role}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
                    {fmtDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
                    {fmtDate(u.lastActiveAt)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs capitalize ${
                        STATUS_STYLE[u.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : anonymized ? (
                      <div className="flex justify-end">
                        <HardDeleteForm userId={u.id} username={u.username} />
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {u.status !== "active" ? (
                          <StatusButton id={u.id} status="active" label="Activate" />
                        ) : null}
                        {u.status !== "suspended" ? (
                          <StatusButton
                            id={u.id}
                            status="suspended"
                            label="Suspend"
                          />
                        ) : null}
                        {u.status !== "banned" ? (
                          <StatusButton id={u.id} status="banned" label="Ban" />
                        ) : null}
                        {archived ? (
                          <>
                            <form action={restoreUserAction}>
                              <input type="hidden" name="id" value={u.id} />
                              <button className={BTN}>Restore</button>
                            </form>
                            <form action={tombstoneUserAction}>
                              <input type="hidden" name="id" value={u.id} />
                              <button className={`${BTN} text-destructive`}>
                                Tombstone
                              </button>
                            </form>
                            <HardDeleteForm userId={u.id} username={u.username} />
                          </>
                        ) : (
                          <form action={archiveUserAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className={`${BTN} text-destructive`}>
                              Archive
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
