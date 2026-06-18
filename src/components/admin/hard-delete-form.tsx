"use client";

import { useState } from "react";

import { hardDeleteUserAction } from "@/app/admin/users/actions";

/**
 * Danger action: permanently delete a user and all their content. Requires the
 * admin to type the exact username before the submit enables.
 */
export function HardDeleteForm({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
      >
        Hard delete
      </button>
    );
  }

  const matches = typed.trim() === username;

  return (
    <form
      action={hardDeleteUserAction}
      className="flex flex-col gap-1 rounded-md border border-destructive/50 bg-destructive/5 p-2"
    >
      <input type="hidden" name="id" value={userId} />
      <p className="max-w-[220px] text-xs text-destructive">
        Permanently deletes this account <strong>and all its content</strong>.
        This cannot be undone. Type <code>{username}</code> to confirm.
      </p>
      <input
        name="confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="username"
        autoComplete="off"
        className="rounded border border-border/60 bg-background px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <button
          disabled={!matches}
          className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-40"
        >
          Delete permanently
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-md border border-border/60 px-2 py-1 text-xs hover:border-border"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
