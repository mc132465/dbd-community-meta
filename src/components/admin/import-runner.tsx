"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  runAssetImportAction,
  runImportAction,
  runImportPackAction,
  type ImportResult,
} from "@/app/admin/import/actions";

const BTN =
  "rounded-md border border-border/60 bg-card px-3 py-1.5 text-sm font-medium hover:border-border disabled:opacity-50";
const FIELD = "rounded-md border border-border/60 bg-card px-2 py-1.5 text-sm";

export function ImportRunner({
  packs,
  sources,
}: {
  packs: string[];
  sources: string[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pack, setPack] = useState(packs[0] ?? "");
  const [source, setSource] = useState(sources[0] ?? "");
  const [newPack, setNewPack] = useState("");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  async function go(label: string, fn: () => Promise<ImportResult>) {
    if (busy) return;
    setBusy(label);
    setResult(null);
    try {
      setResult(await fn());
    } catch {
      setResult({ ok: false, output: "The import could not be started." });
    } finally {
      setBusy(null);
    }
  }

  async function onUpload(file: File) {
    setBusy("upload");
    setUploadMsg(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/assets/upload?name=${encodeURIComponent(file.name)}`,
        { method: "POST", body: file },
      );
      const data = (await res.json()) as { ok: boolean; error?: string; name?: string };
      if (data.ok) {
        setUploadMsg(`Uploaded ${data.name}. Select it below and import.`);
        router.refresh();
      } else {
        setUploadMsg(data.error ?? "Upload failed.");
      }
    } catch {
      setUploadMsg("Upload failed.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Default the new-pack slug from the selected source name.
  function slugFromSource(s: string): string {
    return s
      .replace(/\.zip$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Import an asset pack (ZIP or folder)
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload a ZIP or drop a folder/ZIP into <code>data/assets/</code>. The
          server extracts it, auto-detects the real root (handles nested folders
          like <code>DBD_Icons_1/DBD_Icons_1</code>), sorts it into separated
          categories, and maps PNGs to perks, killers, survivors, powers, items,
          add-ons and maps. Safe to re-run; unmapped files stay in{" "}
          <a className="text-link hover:text-link-hover" href="/admin/assets/packs">
            Asset Packs
          </a>{" "}
          for manual assignment.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="text-sm"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          {busy === "upload" ? (
            <span className="text-sm text-muted-foreground">Uploading…</span>
          ) : null}
        </div>
        {uploadMsg ? (
          <p className="text-sm text-muted-foreground">{uploadMsg}</p>
        ) : null}

        {sources.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={FIELD}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                if (!newPack) setNewPack(slugFromSource(e.target.value));
              }}
            >
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className={FIELD}
              placeholder={source ? slugFromSource(source) : "pack slug"}
              value={newPack}
              onChange={(e) => setNewPack(e.target.value)}
            />
            <button
              className={BTN}
              disabled={!!busy || !source}
              onClick={() =>
                go("pack", () =>
                  runImportPackAction(
                    source,
                    (newPack || slugFromSource(source)).trim(),
                  ),
                )
              }
            >
              {busy === "pack" ? "Importing…" : "Import pack"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No ZIPs or folders found under <code>data/assets/</code> yet. Upload
            one above.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Re-map an existing pack
        </h2>
        {packs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={FIELD}
              value={pack}
              onChange={(e) => setPack(e.target.value)}
            >
              {packs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              className={BTN}
              disabled={!!busy || !pack}
              onClick={() => go("assets", () => runAssetImportAction(pack))}
            >
              {busy === "assets" ? "Running…" : "Re-map pack PNGs"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No organized packs under <code>data/assets/packs/</code> yet.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Game &amp; catalog data
        </h2>
        <p className="text-sm text-muted-foreground">
          Seeds base game data, the character catalog, killer powers, and tier
          lists from the bundled JSON. Safe to re-run.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className={BTN}
            disabled={!!busy}
            onClick={() => go("game", () => runImportAction("game"))}
          >
            {busy === "game" ? "Running…" : "Import game data"}
          </button>
          <button
            className={BTN}
            disabled={!!busy}
            onClick={() => go("characters", () => runImportAction("characters"))}
          >
            {busy === "characters" ? "Running…" : "Import characters"}
          </button>
          <button
            className={BTN}
            disabled={!!busy}
            onClick={() => go("powers", () => runImportAction("powers"))}
          >
            {busy === "powers" ? "Running…" : "Derive killer powers"}
          </button>
          <button
            className={BTN}
            disabled={!!busy}
            onClick={() => go("tierlists", () => runImportAction("tierlists"))}
          >
            {busy === "tierlists" ? "Running…" : "Import tier lists"}
          </button>
        </div>
      </section>

      {result ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {result.ok ? "Result" : "Failed"}
          </h2>
          <pre
            className={`max-h-96 overflow-auto rounded-md border p-3 text-xs ${
              result.ok
                ? "border-border/60 bg-card"
                : "border-destructive/50 bg-destructive/10"
            }`}
          >
            {result.output}
          </pre>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Imports run inside the app container. Large packs can take a minute or
        two; leave this page open until the result appears.
      </p>
    </div>
  );
}
