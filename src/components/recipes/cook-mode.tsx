"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import { timersIn } from "@/lib/recipe-import";
import { cn } from "@/lib/utils";

type RunningTimer = { id: number; label: string; total: number; endsAt: number | null; left: number };

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

function beep() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.4 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.4);
      o.stop(ctx.currentTime + i * 0.4 + 0.3);
    }
  } catch {
    /* audio unavailable */
  }
}

/** Distraction-free cooking: one step at a time, ingredient check-off, timers, screen kept awake. */
export function CookMode({ id, name, ingredients, steps, servingsLabel }: { id: string; name: string; ingredients: string[]; steps: string[]; servingsLabel: string | null }) {
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [awake, setAwake] = useState<"on" | "off" | "unsupported">("off");
  const nextId = useRef(1);
  const total = steps.length;

  // Keep the screen on while cooking (where supported).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (!("wakeLock" in navigator)) {
        if (!cancelled) setAwake("unsupported");
        return;
      }
      try {
        lock = await navigator.wakeLock.request("screen");
        if (!cancelled) setAwake("on");
        lock.addEventListener("release", () => !cancelled && setAwake("off"));
      } catch {
        if (!cancelled) setAwake("off");
      }
    };
    void request();
    const onVis = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, []);

  // Tick running timers.
  useEffect(() => {
    if (!timers.some((t) => t.endsAt)) return;
    const h = setInterval(() => {
      const now = Date.now();
      setTimers((ts) =>
        ts.map((t) => {
          if (!t.endsAt) return t;
          const left = Math.max(0, Math.round((t.endsAt - now) / 1000));
          if (left === 0 && t.left > 0) {
            beep();
            if ("Notification" in window && Notification.permission === "granted") new Notification(`${t.label} timer is done`, { body: name });
          }
          return { ...t, left, endsAt: left === 0 ? null : t.endsAt };
        }),
      );
    }, 250);
    return () => clearInterval(h);
  }, [timers, name]);

  // Arrow keys move between steps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") setStep((s) => Math.min(total - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  const startTimer = (label: string, seconds: number) => {
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    setTimers((ts) => [...ts, { id: nextId.current++, label, total: seconds, endsAt: Date.now() + seconds * 1000, left: seconds }]);
  };
  const toggle = (t: RunningTimer) =>
    setTimers((ts) => ts.map((x) => (x.id !== t.id ? x : x.endsAt ? { ...x, endsAt: null } : { ...x, endsAt: Date.now() + (x.left || x.total) * 1000, left: x.left || x.total })));
  const current = steps[step] ?? "";
  const found = timersIn(current);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/recipes/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to recipe
        </Link>
        <p className="text-sm text-muted">{awake === "on" ? "Screen will stay on" : awake === "unsupported" ? "Tip: keep your screen awake while cooking" : ""}</p>
      </div>
      <h1 className="text-[28px] leading-tight font-semibold sm:text-[34px]">{name}</h1>
      <div className="grid flex-1 gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:max-h-[70dvh] lg:overflow-y-auto">
          <h2 className="mb-1 font-semibold">Ingredients</h2>
          {servingsLabel && <p className="mb-3 text-sm text-muted">{servingsLabel}</p>}
          <ul className="flex flex-col gap-1">
            {ingredients.map((ing, i) => (
              <li key={i}>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-[15px] hover:bg-sunken", checked.has(i) && "text-muted line-through")}>
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={() =>
                      setChecked((c) => {
                        const n = new Set(c);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className="mt-1 size-4 accent-[var(--color-primary-600)]"
                  />
                  {ing}
                </label>
              </li>
            ))}
          </ul>
        </aside>
        <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8" aria-live="polite">
          {total ? (
            <>
              <p className="text-sm font-semibold tracking-[0.12em] text-primary-600 uppercase">
                Step {step + 1} of {total}
              </p>
              <p className="flex-1 font-display text-2xl leading-snug sm:text-3xl">{current}</p>
              {found.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {found.map((t, i) => (
                    <button key={i} type="button" onClick={() => startTimer(t.label, t.seconds)} className="inline-flex h-11 items-center gap-2 rounded-full bg-olive-50 px-4 text-[15px] font-semibold text-olive-700 hover:bg-olive-100">
                      <Timer className="size-4" aria-hidden /> Start {t.label} timer
                    </button>
                  ))}
                </div>
              )}
              <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full bg-primary-500 transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex h-14 items-center gap-2 rounded-2xl border border-line-strong px-5 text-lg font-medium disabled:opacity-40">
                  <ChevronLeft className="size-5" /> Back
                </button>
                {step < total - 1 ? (
                  <button type="button" onClick={() => setStep((s) => Math.min(total - 1, s + 1))} className="inline-flex h-14 items-center gap-2 rounded-2xl bg-primary-600 px-6 text-lg font-semibold text-white hover:bg-primary-700">
                    Next <ChevronRight className="size-5" />
                  </button>
                ) : (
                  <Link href={`/recipes/${id}`} className="inline-flex h-14 items-center rounded-2xl bg-primary-600 px-6 text-lg font-semibold text-white hover:bg-primary-700">
                    Done — enjoy! 🎉
                  </Link>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted">This recipe has no steps yet.</p>
          )}
        </section>
      </div>
      {timers.length > 0 && (
        <div className="sticky bottom-24 flex flex-wrap gap-2 sm:bottom-4" aria-label="Timers">
          {timers.map((t) => (
            <div key={t.id} className={cn("flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 shadow-lg", t.left === 0 ? "animate-pulse bg-wine-600 text-white" : "bg-ink text-white")}>
              <span className="text-sm">{t.label}</span>
              <span className="font-mono text-lg font-semibold tabular-nums" role="timer">
                {t.left === 0 ? "Done!" : fmt(t.left)}
              </span>
              <button type="button" onClick={() => toggle(t)} aria-label={t.endsAt ? "Pause timer" : "Resume timer"} className="size-9 rounded-full hover:bg-white/15">
                {t.left === 0 ? <RotateCcw className="mx-auto size-4" /> : t.endsAt ? <Pause className="mx-auto size-4" /> : <Play className="mx-auto size-4" />}
              </button>
              <button type="button" onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Remove timer" className="size-9 rounded-full hover:bg-white/15">
                <X className="mx-auto size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
