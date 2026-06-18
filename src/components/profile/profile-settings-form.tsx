"use client";

import { useState } from "react";

import {
  PLAYSTYLE_TAGS,
  PRESET_AVATARS,
} from "@/lib/profile/constants";
import { saveProfileSettingsAction } from "@/app/account/profile/actions";

export function ProfileSettingsForm({
  initial,
}: {
  initial: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    isPublic: boolean;
    playstyleTags: string[];
  };
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [tags, setTags] = useState<string[]>(initial.playstyleTags);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleTag(key: string) {
    setTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await saveProfileSettingsAction({
        displayName,
        bio,
        avatarUrl,
        isPublic,
        playstyleTags: tags,
      });
      setMsg(r.ok ? "Saved." : r.error);
    } catch {
      setMsg("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 rounded-lg border border-border/60 bg-card p-5">
      <div>
        <label className="text-sm font-medium">Avatar</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_AVATARS.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setAvatarUrl(src)}
              className={`overflow-hidden rounded-md border-2 ${
                avatarUrl === src ? "border-primary" : "border-transparent"
              }`}
              aria-pressed={avatarUrl === src}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" width={48} height={48} className="h-12 w-12" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAvatarUrl(null)}
            className={`rounded-md border px-3 text-xs ${
              avatarUrl === null
                ? "border-primary text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            None
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
          value={displayName}
          maxLength={50}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="bio">
          About me
        </label>
        <textarea
          id="bio"
          className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
          rows={3}
          maxLength={500}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short bio (max 500 chars)."
        />
      </div>

      <div>
        <span className="text-sm font-medium">Playstyle</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLAYSTYLE_TAGS.map((t) => {
            const active = tags.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(t.key)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Public profile (others can see your favorites, picks, and activity)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
      </div>
    </div>
  );
}
