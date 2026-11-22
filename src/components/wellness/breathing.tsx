"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { breathAt, BREATHING } from "@/lib/wellness-insights";
import { cn } from "@/lib/utils";

const LENGTHS = [1, 2, 3, 5, 10];

/**
 * Guided breathing: a circle grows as you breathe in and shrinks as you
 * breathe out, with the words and a countdown (the circle stays still for
 * reduced motion; the words carry everything).
 */
export function BreathingTimer() {
  const [pattern, setPattern] = useState(BREATHING[0]!.key);
  const [minutes, setMinutes] = useState(2);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  const p = BREATHING.find((b) => b.key === pattern)!;
  const total = minutes * 60;
  const done = elapsed >= total;

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      const e = baseRef.current + (Date.now() - startRef.current!) / 1000;
      setElapsed(Math.min(e, total));
      if (e >= total) setRunning(false);
    }, 200);
    return () => {
      clearInterval(id);
      baseRef.current += (Date.now() - (startRef.current ?? Date.now())) / 1000;
    };
  }, [running, total]);

  const at = breathAt(p.phases, elapsed);
  const inPhase = p.phases[at.index]!;
  const progress = (inPhase.seconds - at.left + ((elapsed % 1) || 0)) / inPhase.seconds;
  const scale = inPhase.label === "Breathe in" ? 0.55 + 0.45 * progress : inPhase.label === "Breathe out" ? 1 - 0.45 * progress : at.index > 0 && p.phases[at.index - 1]?.label === "Breathe in" ? 1 : 0.55;
  const reset = () => {
    setRunning(false);
    baseRef.current = 0;
    setElapsed(0);
  };
  const left = Math.max(0, Math.ceil(total - elapsed));

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Pattern
          <select value={pattern} onChange={(e) => (setPattern(e.target.value), reset())} className="h-11 rounded-xl border border-line-strong bg-surface px-3">
            {BREATHING.map((b) => (
              <option key={b.key} value={b.key}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Length
          <div className="flex gap-1.5" role="radiogroup" aria-label="Length">
            {LENGTHS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => (setMinutes(m), reset())} className={cn("h-11 min-w-12 rounded-full px-3 text-sm ring-1 ring-line", minutes === m ? "bg-primary-600 text-white ring-primary-600" : "bg-surface hover:bg-sunken")}>
                {m} min
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-center text-sm text-muted">{p.about}</p>

      <div className="relative flex size-64 items-center justify-center" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-primary-50" />
        <div className="absolute inset-0 rounded-full bg-primary-200/70 transition-transform duration-200 ease-linear motion-reduce:transition-none motion-reduce:[transform:scale(0.8)!important]" style={{ transform: `scale(${running || elapsed ? scale : 0.55})` }} />
        <div className="relative text-center">
          <p className="text-2xl font-semibold text-primary-800">{done ? "Well done" : running || elapsed ? inPhase.label : "Ready"}</p>
          {(running || elapsed > 0) && !done && <p className="text-4xl font-semibold tabular-nums text-primary-700">{at.left}</p>}
        </div>
      </div>
      <p className="sr-only" aria-live="assertive">
        {running ? `${inPhase.label}, ${inPhase.seconds} seconds` : ""}
      </p>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => (done ? (reset(), setRunning(true)) : setRunning((r) => !r))} className="inline-flex h-14 items-center gap-2 rounded-full bg-primary-600 px-8 text-lg font-semibold text-white hover:bg-primary-700 focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none">
          {running ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          {running ? "Pause" : done ? "Again" : elapsed ? "Resume" : "Start"}
        </button>
        <button type="button" onClick={reset} aria-label="Reset" className="inline-flex size-12 items-center justify-center rounded-full ring-1 ring-line hover:bg-sunken">
          <RotateCcw className="size-5" />
        </button>
      </div>
      <p className="text-sm text-muted tabular-nums">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left · {at.cycle} breath{at.cycle === 1 ? "" : "s"} so far
      </p>
    </div>
  );
}
