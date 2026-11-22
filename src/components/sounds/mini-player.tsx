"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Play, Square, Timer, X } from "lucide-react";
import { formatRemaining } from "@/lib/sounds/catalog";
import { cn } from "@/lib/utils";
import { useCountdown, usePlayer } from "./player";

export function SoundBars({ on, className }: { on: boolean; className?: string }) {
  return (
    <span className={cn("sound-bars flex h-5 items-end gap-[3px]", className)} data-on={on} aria-hidden>
      <span className="h-5" />
      <span className="h-4" />
      <span className="h-5" />
      <span className="h-3" />
    </span>
  );
}

/**
 * Compact player that stays on screen while browsing the app: what's
 * playing, the sleep timer, and one tap to pause or stop. Above the bottom
 * menu on phones; a small card on larger screens (hidden on the Sleep Sounds
 * page itself, which has the full player).
 */
export function SoundMiniPlayer() {
  const p = usePlayer();
  const path = usePathname();
  const remaining = useCountdown(p?.timer.endsAt ?? null);
  if (!p?.now) return null;
  const onSounds = path?.startsWith("/sounds");
  const playing = p.status === "playing";
  const btn = "inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none";

  return (
    <>
      {/* Room at the end of the page so the player never covers content. */}
      <div aria-hidden className={cn("h-16", onSounds && "sm:hidden")} />
      <section
        aria-label="Sleep Sounds player"
        className={cn(
          "fixed inset-x-2 z-30 flex items-center gap-2 rounded-2xl border border-line bg-surface/95 p-1.5 pl-3 shadow-[var(--shadow-pop)] backdrop-blur print:hidden",
          "bottom-[calc(4.4rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96",
          onSounds && "sm:hidden",
        )}
      >
        <SoundBars on={playing && !p.fading} className="text-primary-600" />
        <Link href="/sounds" className="min-w-0 flex-1 rounded-lg focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none">
          <span className="block truncate text-sm font-semibold">{p.now.name}</span>
          <span className="flex items-center gap-1 text-xs text-muted">
            {p.fading ? (
              "Fading out…"
            ) : playing && remaining !== null ? (
              <>
                <Timer className="size-3" aria-hidden /> {formatRemaining(remaining)} left
              </>
            ) : playing ? (
              "Playing"
            ) : p.status === "paused" ? (
              "Paused"
            ) : (
              "Stopped"
            )}
          </span>
        </Link>
        <button type="button" onClick={() => void p.toggle()} className={cn(btn, "bg-primary-600 text-white hover:bg-primary-700")} aria-label={playing ? `Pause ${p.now.name}` : `Play ${p.now.name}`}>
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        {p.status !== "stopped" ? (
          <button type="button" onClick={p.stop} className={cn(btn, "text-ink-soft hover:bg-sunken")} aria-label="Stop">
            <Square className="size-4" />
          </button>
        ) : (
          <button type="button" onClick={p.close} className={cn(btn, "text-muted hover:bg-sunken")} aria-label="Close player">
            <X className="size-5" />
          </button>
        )}
      </section>
    </>
  );
}
