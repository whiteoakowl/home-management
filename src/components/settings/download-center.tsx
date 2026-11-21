"use client";

import { useState } from "react";
import { downloadZip } from "client-zip";
import { Download, FileSpreadsheet, Images, LoaderCircle } from "lucide-react";

const stamp = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "family";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** One spreadsheet-friendly CSV for a list of records. */
function toCsv(rows: Record<string, unknown>[]) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

/**
 * Account settings → Download: every photo (as a zip of folders) and every
 * saved record (spreadsheets + a complete data file). Built in the browser,
 * one photo at a time, so it works however many photos the family has.
 */
export function DownloadCenter({ familyName }: { familyName: string }) {
  const [busy, setBusy] = useState<"photos" | "data" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const photos = async () => {
    setBusy("photos");
    setMsg("Getting the list of photos…");
    try {
      const res = await fetch("/api/export/photos", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const list = (await res.json()) as { count: number; photos: { id: string; path: string; taken: string }[] };
      if (!list.count) {
        setMsg("There aren't any photos to download yet.");
        return;
      }
      let done = 0;
      let failed = 0;
      async function* items() {
        for (const p of list.photos) {
          const r = await fetch(`/api/files/${p.id}`).catch(() => null);
          done++;
          setMsg(`Adding photo ${done} of ${list.count}…`);
          if (!r || !r.ok) {
            failed++;
            continue;
          }
          yield { name: p.path, input: await r.blob(), lastModified: p.taken ? new Date(`${p.taken}T12:00:00`) : new Date() };
        }
      }
      const blob = await downloadZip(items()).blob();
      save(blob, `${slug(familyName)}-photos-${stamp()}.zip`);
      setMsg(`Done: ${list.count - failed} photo${list.count - failed === 1 ? "" : "s"} in folders by album, memory and pet.${failed ? ` (${failed} couldn't be read.)` : ""}`);
    } catch {
      setMsg("The download didn't finish. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const data = async () => {
    setBusy("data");
    setMsg("Gathering everything your family has saved…");
    try {
      const res = await fetch("/api/export", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      // Very large families get a compressed file (see /api/export).
      const gz = /gzip/.test(res.headers.get("content-type") ?? "");
      const text = gz && res.body ? await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text() : await res.text();
      const json = JSON.parse(text) as { tables: Record<string, Record<string, unknown>[]>; people?: Record<string, unknown>[]; family?: Record<string, unknown> };
      const sheets = Object.entries(json.tables ?? {}).filter(([, rows]) => rows.length);
      const readme = [
        `${familyName} family: everything saved in the app (${stamp()})`,
        "",
        "Spreadsheets/  one file per kind of record (open in Excel, Numbers or Google Sheets).",
        "family-data.json  everything in one file (for moving to another app).",
        "",
        "Other people's private items (private journals, health and wellness tracking, private spaces) aren't included.",
        "Photos are in a separate download (Account settings > Download all photos).",
      ].join("\r\n");
      const files = [
        { name: "README.txt", input: readme },
        { name: "family-data.json", input: JSON.stringify(json, null, 2) },
        ...(json.people?.length ? [{ name: "Spreadsheets/people.csv", input: toCsv(json.people) }] : []),
        ...sheets.map(([table, rows]) => ({ name: `Spreadsheets/${table}.csv`, input: toCsv(rows) })),
      ];
      save(await downloadZip(files).blob(), `${slug(familyName)}-data-${stamp()}.zip`);
      setMsg(`Done: ${sheets.length} spreadsheets plus a complete data file.`);
    } catch {
      setMsg("The download didn't finish. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const btn = "inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-[15px] font-medium hover:bg-sunken disabled:opacity-60";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={photos} disabled={!!busy} className={btn}>
          {busy === "photos" ? <LoaderCircle className="size-4 animate-spin" /> : <Images className="size-4" />} Download all photos
        </button>
        <button type="button" onClick={data} disabled={!!busy} className={btn}>
          {busy === "data" ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} Download all saved information
        </button>
      </div>
      {msg && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-ink-soft">
          <Download className="size-4 shrink-0 text-primary-600" /> {msg}
        </p>
      )}
      <p className="text-xs text-muted">Photos come as a zip with folders for each album, memory and pet. Saved information comes as spreadsheets plus one complete data file. Keep the phone or computer awake until it finishes.</p>
    </div>
  );
}
