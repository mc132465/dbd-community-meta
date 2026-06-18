"use client";

import { useState } from "react";
import { toast } from "sonner";

import type {
  ApplyMode,
  ImportPreview,
  ImportResult,
} from "@/lib/services/backup.service";
import {
  applyBackupAction,
  previewBackupAction,
} from "@/app/admin/backup/actions";
import { Button } from "@/components/ui/button";

type TableRow = { add: number; exists: number; invalid: number };

function PreviewCounts({
  title,
  data,
  extra,
}: {
  title: string;
  data: TableRow;
  extra?: { label: string; value: number };
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Add <span className="font-medium text-foreground">{data.add}</span>
        </span>
        <span>
          Already exist{" "}
          <span className="font-medium text-foreground">{data.exists}</span>
        </span>
        <span>
          Invalid (skipped){" "}
          <span className="font-medium text-foreground">{data.invalid}</span>
        </span>
        {extra ? (
          <span>
            {extra.label}{" "}
            <span className="font-medium text-foreground">{extra.value}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ResultCounts({
  title,
  added,
  updated,
  skipped,
  invalid,
  unmapped,
}: {
  title: string;
  added: number;
  updated: number;
  skipped: number;
  invalid: number;
  unmapped?: number;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Added <span className="font-medium text-foreground">{added}</span>
        </span>
        <span>
          Updated <span className="font-medium text-foreground">{updated}</span>
        </span>
        <span>
          Skipped <span className="font-medium text-foreground">{skipped}</span>
        </span>
        <span>
          Invalid <span className="font-medium text-foreground">{invalid}</span>
        </span>
        {unmapped !== undefined ? (
          <span>
            Unmapped{" "}
            <span className="font-medium text-foreground">{unmapped}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function BackupImport() {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<ApplyMode>("merge");
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    setText(null);
    setBusy(true);
    try {
      const content = await file.text();
      const res = await previewBackupAction(content);
      setPreview(res);
      if (res.ok) setText(content);
      else toast.error(res.error);
    } catch {
      toast.error("Couldn't read that file.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onApply() {
    if (!text) return;
    const label =
      mode === "overwrite"
        ? "Apply and OVERWRITE existing rows? Nothing is ever deleted."
        : "Apply backup? Only missing rows are added; existing rows are left unchanged.";
    if (!confirm(label)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await applyBackupAction(text, mode);
      setResult(res);
      if (res.ok) toast.success("Import applied");
      else toast.error(res.error);
    } catch {
      toast.error("Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" disabled={busy}>
          <label className="cursor-pointer">
            {busy ? "Working…" : "Choose backup .json"}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFile}
            />
          </label>
        </Button>
        {fileName ? (
          <span className="text-xs text-muted-foreground">{fileName}</span>
        ) : null}
      </div>

      {preview && !preview.ok ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {preview.error}
        </p>
      ) : null}

      {preview && preview.ok ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Preview (dry run) — version {preview.version}, scope {preview.scope}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {preview.settings ? (
              <PreviewCounts title="Settings" data={preview.settings} />
            ) : null}
            {preview.packs ? (
              <PreviewCounts title="Asset packs" data={preview.packs} />
            ) : null}
            {preview.images ? (
              <PreviewCounts
                title="Asset images"
                data={preview.images}
                extra={{
                  label: "Would import unmapped",
                  value: preview.images.wouldUnmap,
                }}
              />
            ) : null}
          </div>

          {preview.warnings.length > 0 ? (
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium">Warnings</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Apply controls */}
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium">Apply</p>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "merge"}
                  onChange={() => setMode("merge")}
                />
                Merge — add missing rows only (existing rows untouched)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "overwrite"}
                  onChange={() => setMode("overwrite")}
                />
                Merge + overwrite — also update existing rows
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Non-destructive: rows not present in the backup are never deleted.
            </p>
            <Button disabled={busy} onClick={onApply}>
              {busy ? "Applying…" : "Apply import"}
            </Button>
          </div>
        </div>
      ) : null}

      {result && !result.ok ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {result.error}
        </p>
      ) : null}

      {result && result.ok ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Import applied ({result.mode}).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.settings ? (
              <ResultCounts title="Settings" {...result.settings} />
            ) : null}
            {result.packs ? (
              <ResultCounts title="Asset packs" {...result.packs} />
            ) : null}
            {result.images ? (
              <ResultCounts title="Asset images" {...result.images} />
            ) : null}
          </div>
          {result.warnings.length > 0 ? (
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium">Warnings</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
