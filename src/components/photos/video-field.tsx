"use client";

import { useState } from "react";
import { Film, X } from "lucide-react";
import { beginVideoUpload } from "@/app/actions/media";

type Up = { key: string; name: string; progress: number; fileId?: string; error?: string };

/**
 * Pick videos; each one uploads right away, straight to storage, with a
 * progress bar. Finished ones are posted with the form as videoIds.
 */
export function VideoField({ name = "videoIds", label = "Videos" }: { name?: string; label?: string }) {
  const [ups, setUps] = useState<Up[]>([]);
  const set = (key: string, patch: Partial<Up>) => setUps((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const upload = async (file: File) => {
    const key = `${file.name}-${file.size}-${Math.random()}`;
    setUps((u) => [...u, { key, name: file.name, progress: 0 }]);
    const start = await beginVideoUpload({ name: file.name, size: file.size, type: file.type });
    if (!start.ok) return set(key, { error: start.message });
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", start.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      if (start.direct) xhr.setRequestHeader("x-upsert", "true");
      xhr.upload.onprogress = (e) => e.lengthComputable && set(key, { progress: Math.round((e.loaded / e.total) * 100) });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) set(key, { progress: 100, fileId: start.fileId });
        else set(key, { error: xhr.status === 413 || xhr.status === 400 ? "This video is too large to upload." : "Upload failed. Try again." });
        resolve();
      };
      xhr.onerror = () => {
        set(key, { error: "The connection dropped. Try again." });
        resolve();
      };
      xhr.send(file);
    });
  };

  const busy = ups.some((u) => !u.fileId && !u.error);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <label className="inline-flex h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-sm font-medium hover:bg-sunken">
        <Film className="size-4" /> Add videos
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/3gpp"
          multiple
          className="sr-only"
          onChange={(e) => {
            for (const f of Array.from(e.target.files ?? [])) void upload(f);
            e.target.value = "";
          }}
        />
      </label>
      {ups.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {ups.map((u) => (
            <li key={u.key} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.error ? (
                <span className="text-wine-700">{u.error}</span>
              ) : (
                <span className="flex w-28 items-center gap-1.5">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <span className="block h-full bg-primary-500" style={{ width: `${u.progress}%` }} />
                  </span>
                  <span className="w-9 text-right text-xs tabular-nums">{u.fileId ? "✓" : `${u.progress}%`}</span>
                </span>
              )}
              <button type="button" aria-label={`Remove ${u.name}`} onClick={() => setUps((x) => x.filter((y) => y.key !== u.key))} className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-sunken">
                <X className="size-4" />
              </button>
              {u.fileId && <input type="hidden" name={name} value={u.fileId} />}
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="text-xs font-medium text-primary-700">Uploading… please wait until it finishes before saving.</p>}
    </div>
  );
}
