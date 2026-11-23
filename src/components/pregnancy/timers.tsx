"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RotateCcw, Save } from "lucide-react";
import { saveContractionSession, saveKickSession } from "@/app/actions/pregnancy";
import { contractionStats, type Contraction } from "@/lib/pregnancy/dates";
import { cn } from "@/lib/utils";

/**
 * Kick counter and contraction timer. The session in progress lives on this
 * device (localStorage) so a reload, a locked phone or a dropped connection
 * never loses it; it's saved to the pregnancy when you tap Save.
 */
const read = <T,>(key: string): T | null => {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, v: unknown) => {
  try {
    if (v === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: the session still works until the page closes */
  }
};

function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

const mmss = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50";

// ─── Kick counter ───────────────────────────────────────────────────────────

type KickSession = { start: string; times: string[]; paused: number; pausedAt: string | null };

export function KickCounter({ pregnancyId, target = 10, canSave }: { pregnancyId: string; target?: number; canSave: boolean }) {
  const key = `hearth.kicks.${pregnancyId}`;
  const router = useRouter();
  const [s, setS] = useState<KickSession | null>(null);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Load the device's session after mount (not during render: no hydration mismatch).
  useEffect(() => {
    const t = setTimeout(() => setS(read<KickSession>(key)), 0);
    return () => clearTimeout(t);
  }, [key]);
  const now = useTick(!!s && !s.pausedAt);
  const update = (n: KickSession | null) => {
    setS(n);
    write(key, n);
  };
  const elapsed = s ? (s.pausedAt ? Date.parse(s.pausedAt) : now) - Date.parse(s.start) - s.paused : 0;
  const count = s?.times.length ?? 0;
  const tap = () => {
    const t = new Date().toISOString();
    if (!s) update({ start: t, times: [t], paused: 0, pausedAt: null });
    else if (!s.pausedAt) update({ ...s, times: [...s.times, t] });
    if ("vibrate" in navigator) navigator.vibrate?.(20);
  };
  const save = async () => {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    const res = await saveKickSession({ pregnancyId, start: s.start, end: s.pausedAt ?? new Date().toISOString(), times: s.times, notes });
    setSaving(false);
    if (res.ok) {
      update(null);
      setNotes("");
      setMsg("Saved.");
      router.refresh();
    } else setMsg(res.message);
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={tap}
        disabled={!!s?.pausedAt || !canSave}
        className="flex size-48 flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60 sm:size-56"
        aria-label={`Count a movement. ${count} so far.`}
      >
        <span className="text-6xl font-bold tabular-nums">{count}</span>
        <span className="text-sm opacity-90">{s ? "Tap for each movement" : "Tap to start"}</span>
      </button>
      <p className="text-center text-sm text-muted" aria-live="polite">
        {s ? (
          <>
            {mmss(elapsed)} {s.pausedAt ? "(paused)" : "elapsed"}
            {count >= target && ` · ${target} movements reached`}
          </>
        ) : (
          `Count until you feel ${target} movements (kicks, rolls, jabs or swishes).`
        )}
      </p>
      {s && (
        <div className="flex w-full max-w-md flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={cn(btn, "bg-sunken ring-1 ring-line")} onClick={() => update(s.pausedAt ? { ...s, paused: s.paused + (Date.now() - Date.parse(s.pausedAt)), pausedAt: null } : { ...s, pausedAt: new Date().toISOString() })}>
              {s.pausedAt ? <Play className="size-4" /> : <Pause className="size-4" />}
              {s.pausedAt ? "Resume" : "Pause"}
            </button>
            <button type="button" className={cn(btn, "bg-sunken ring-1 ring-line")} onClick={() => update(s.times.length > 1 ? { ...s, times: s.times.slice(0, -1) } : null)}>
              Undo
            </button>
            <button type="button" className={cn(btn, "bg-sunken text-wine-600 ring-1 ring-line")} onClick={() => window.confirm("Clear this session without saving?") && update(null)}>
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Notes (optional): after lunch, lying on left side…" className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-[15px]" aria-label="Notes" />
          <button type="button" onClick={save} disabled={saving || !canSave} className={cn(btn, "bg-primary-600 text-white hover:bg-primary-700")}>
            <Save className="size-4" /> {saving ? "Saving…" : "Save session"}
          </button>
        </div>
      )}
      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

// ─── Contraction timer ──────────────────────────────────────────────────────

export function ContractionTimer({ pregnancyId, canSave }: { pregnancyId: string; canSave: boolean }) {
  const key = `hearth.contractions.${pregnancyId}`;
  const router = useRouter();
  const [list, setList] = useState<Contraction[]>([]);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setList(read<Contraction[]>(key) ?? []), 0);
    return () => clearTimeout(t);
  }, [key]);
  const running = list.length > 0 && list[list.length - 1]!.e === null;
  const now = useTick(list.length > 0);
  const update = (n: Contraction[]) => {
    setList(n);
    write(key, n.length ? n : null);
  };
  const toggle = () => {
    const t = new Date().toISOString();
    if (running) update(list.map((c, i) => (i === list.length - 1 ? { ...c, e: t } : c)));
    else update([...list, { s: t, e: null }]);
    if ("vibrate" in navigator) navigator.vibrate?.(30);
  };
  const stats = contractionStats(list);
  const last = list[list.length - 1];
  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await saveContractionSession({ pregnancyId, contractions: list.filter((c) => c.e), notes });
    setSaving(false);
    if (res.ok) {
      update([]);
      setNotes("");
      setMsg("Session saved.");
      router.refresh();
    } else setMsg(res.message);
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={toggle}
        disabled={!canSave}
        className={cn("flex size-48 flex-col items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 sm:size-56", running ? "bg-gradient-to-br from-wine-500 to-wine-700" : "bg-gradient-to-br from-primary-500 to-primary-700")}
        aria-label={running ? "Contraction ended" : "Contraction started"}
      >
        <span className="text-4xl font-bold tabular-nums">{running && last ? mmss(now - Date.parse(last.s)) : last?.e ? mmss(now - Date.parse(last.e)) : "Start"}</span>
        <span className="mt-1 text-sm opacity-90">{running ? "Tap when it ends" : last?.e ? "since the last one · tap at the next" : "Tap when one starts"}</span>
      </button>
      <dl className="grid w-full max-w-md grid-cols-2 gap-2 text-center sm:grid-cols-4" aria-live="polite">
        {[
          ["Timed", String(stats.count)],
          ["Avg length", stats.avgSeconds !== null ? `${Math.round(stats.avgSeconds)}s` : "—"],
          ["Avg apart", stats.avgInterval !== null ? `${stats.avgInterval} min` : "—"],
          ["Session", `${stats.spanMinutes} min`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-sunken px-2 py-2">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-md text-center text-xs text-muted">Averages use the last 6. This timer only records times: it can&apos;t tell whether labor has started. Follow your provider&apos;s instructions on when to call or go in.</p>
      {stats.rows.length > 0 && (
        <ol className="w-full max-w-md divide-y divide-line rounded-xl border border-line text-sm">
          {[...stats.rows].reverse().slice(0, 12).map((r) => (
            <li key={r.start} className="flex justify-between px-3 py-2 tabular-nums">
              <span>{clock(r.start)}</span>
              <span>{r.seconds}s long</span>
              <span className="text-muted">{r.interval !== null ? `${r.interval} min apart` : "first"}</span>
            </li>
          ))}
        </ol>
      )}
      {list.length > 0 && (
        <div className="flex w-full max-w-md flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={cn(btn, "bg-sunken ring-1 ring-line")} onClick={() => update(list.slice(0, -1))}>
              Undo last
            </button>
            <button type="button" className={cn(btn, "bg-sunken text-wine-600 ring-1 ring-line")} onClick={() => window.confirm("Clear this session without saving?") && update([])}>
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Notes (optional)" className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-[15px]" aria-label="Notes" />
          <button type="button" onClick={save} disabled={saving || running || !stats.count} className={cn(btn, "bg-primary-600 text-white hover:bg-primary-700")}>
            <Save className="size-4" /> {saving ? "Saving…" : running ? "End the current one to save" : "Save session"}
          </button>
        </div>
      )}
      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
