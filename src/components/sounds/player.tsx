"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePremium } from "@/components/billing/plan-context";
import { recordRecentSound } from "@/app/actions/sounds";
import { fadeSecondsFor, FREE_TIMERS, isFreeSound, MAX_MIX_ITEMS, soundById, type MixItem } from "@/lib/sounds/catalog";
import { soundEngine } from "@/lib/sounds/engine";

/** What's loaded in the player. */
export type NowPlaying = {
  kind: "sound" | "mix" | "preset";
  /** Sound id, saved-mix id or preset id. */
  refId: string;
  name: string;
  items: MixItem[];
  /** For a saved mix: may the viewer save changes to it? */
  canEdit?: boolean;
  /** Changed since it was loaded (offer Save). */
  dirty?: boolean;
};

type Status = "stopped" | "playing" | "paused";
type Timer = { minutes: number; fade: boolean; endsAt: number | null };

type Player = {
  now: NowPlaying | null;
  status: Status;
  volume: number;
  muted: boolean;
  timer: Timer;
  fading: boolean;
  error: string | null;
  play: (n: NowPlaying) => Promise<void>;
  toggle: () => Promise<void>;
  stop: () => void;
  restart: () => Promise<void>;
  close: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setTimer: (minutes: number, fade?: boolean) => void;
  setItemVolume: (soundId: string, v: number) => void;
  toggleItemMute: (soundId: string) => void;
  addItem: (soundId: string) => Promise<void>;
  removeItem: (soundId: string) => void;
  moveItem: (soundId: string, by: -1 | 1) => void;
  markSaved: (n: Partial<NowPlaying>) => void;
  applyDefaults: (d: { volume: number; timer: number; fade: boolean }) => void;
};

const Ctx = createContext<Player | null>(null);
export const usePlayer = () => useContext(Ctx);

const isPlayingSound = (now: NowPlaying | null, status: Status, soundId: string) => status !== "stopped" && !!now?.items.some((i) => i.soundId === soundId && !i.muted);
export { isPlayingSound };

/**
 * The Sleep Sounds player for the whole app. It sits in the app layout, so
 * sound keeps playing while you move between pages. Nothing starts until
 * someone taps Play (browsers require that), and the audio hardware is put
 * to sleep when nothing is playing.
 */
export function SoundPlayerProvider({ children }: { children: ReactNode }) {
  const premium = usePremium();
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [status, setStatus] = useState<Status>("stopped");
  const [volume, setVol] = useState(60);
  const [muted, setMuted] = useState(false);
  const [timer, setTimerState] = useState<Timer>({ minutes: 60, fade: true, endsAt: null });
  const [fading, setFading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultsApplied = useRef(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const statusRef = useRef<Status>("stopped");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /** Only sounds this family's plan includes. */
  const allowed = useCallback((items: MixItem[]) => items.filter((i) => soundById(i.soundId) && (premium || isFreeSound(i.soundId))).slice(0, MAX_MIX_ITEMS), [premium]);
  const allowedTimer = useCallback((m: number) => (premium || m === 0 || FREE_TIMERS.includes(m) ? m : 60), [premium]);

  const clearTimers = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };

  const stopNow = useCallback(() => {
    clearTimers();
    soundEngine().stopAll();
    setStatus("stopped");
    setFading(false);
    setTimerState((t) => ({ ...t, endsAt: null }));
  }, []);

  /** (Re)arm the sleep timer from now. */
  const arm = useCallback(
    (t: { minutes: number; fade: boolean }) => {
      clearTimers();
      setFading(false);
      soundEngine().cancelFade();
      if (!t.minutes) {
        setTimerState({ ...t, endsAt: null });
        return;
      }
      const ms = t.minutes * 60_000;
      const endsAt = Date.now() + ms;
      setTimerState({ ...t, endsAt });
      const fade = t.fade && premium ? fadeSecondsFor(t.minutes) : 0;
      if (fade) {
        timeouts.current.push(
          setTimeout(() => {
            setFading(true);
            soundEngine().fadeOutAll(fade, () => {
              setStatus("stopped");
              setFading(false);
              setTimerState((x) => ({ ...x, endsAt: null }));
            });
          }, ms - fade * 1000),
        );
      } else timeouts.current.push(setTimeout(stopNow, ms));
    },
    [premium, stopNow],
  );

  const start = useCallback(
    async (n: NowPlaying, opts: { keepTimer?: boolean } = {}) => {
      setError(null);
      const items = allowed(n.items);
      if (!items.length) {
        setError(premium ? "Add a sound to play." : "That sound is part of Premium.");
        return;
      }
      try {
        const e = soundEngine();
        await e.unlock();
        e.setMaster(volume, muted);
        e.sync(items);
      } catch {
        setError("Sound couldn't start in this browser.");
        return;
      }
      setNow({ ...n, items });
      setStatus("playing");
      if (!opts.keepTimer) arm(timer);
    },
    [allowed, arm, muted, premium, timer, volume],
  );

  const play = useCallback(
    async (n: NowPlaying) => {
      await start(n);
      void recordRecentSound({ type: n.kind, id: n.refId }).catch(() => undefined);
    },
    [start],
  );

  const toggle = useCallback(async () => {
    if (!now) return;
    if (status === "playing") {
      await soundEngine().pause();
      clearTimers();
      setStatus("paused");
      setTimerState((t) => ({ ...t, endsAt: null }));
    } else if (status === "paused") {
      await soundEngine().resume();
      setStatus("playing");
      arm(timer);
    } else await start(now);
  }, [arm, now, start, status, timer]);

  const restart = useCallback(async () => {
    if (!now) return;
    soundEngine().stopAll(0.2);
    await new Promise((r) => setTimeout(r, 260));
    await start(now);
  }, [now, start]);

  const close = useCallback(() => {
    stopNow();
    setNow(null);
  }, [stopNow]);

  const setVolume = useCallback(
    (v: number) => {
      setVol(v);
      soundEngine().setMaster(v, muted);
    },
    [muted],
  );
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      soundEngine().setMaster(volume, !m);
      return !m;
    });
  }, [volume]);

  const setTimer = useCallback(
    (minutes: number, fade?: boolean) => {
      const t = { minutes: allowedTimer(minutes), fade: fade ?? timer.fade };
      if (statusRef.current === "playing") arm(t);
      else setTimerState({ ...t, endsAt: null });
    },
    [allowedTimer, arm, timer.fade],
  );

  /** Change the mix and keep the engine in step. */
  const editItems = useCallback(
    (fn: (items: MixItem[]) => MixItem[]) => {
      setNow((n) => {
        if (!n) return n;
        const items = allowed(fn(n.items));
        if (statusRef.current === "playing") soundEngine().sync(items);
        return { ...n, items, dirty: true, ...(n.kind === "sound" && items.length > 1 ? { kind: "preset" as const, refId: "custom", name: "My mix" } : {}) };
      });
    },
    [allowed],
  );

  const value = useMemo<Player>(
    () => ({
      now,
      status,
      volume,
      muted,
      timer,
      fading,
      error,
      play,
      toggle,
      stop: stopNow,
      restart,
      close,
      setVolume,
      toggleMute,
      setTimer,
      setItemVolume: (id, v) => editItems((xs) => xs.map((x) => (x.soundId === id ? { ...x, volume: v } : x))),
      toggleItemMute: (id) => editItems((xs) => xs.map((x) => (x.soundId === id ? { ...x, muted: !x.muted } : x))),
      addItem: async (id) => {
        if (!now) {
          await play({ kind: "preset", refId: "custom", name: "My mix", items: [{ soundId: id, volume: 60 }], dirty: true });
          return;
        }
        if (now.items.some((x) => x.soundId === id)) return;
        if (statusRef.current !== "playing") {
          const n = { ...now, items: [...now.items, { soundId: id, volume: 50 }], dirty: true };
          await start(n.kind === "sound" ? { ...n, kind: "preset", refId: "custom", name: "My mix" } : n);
          return;
        }
        editItems((xs) => [...xs, { soundId: id, volume: 50 }]);
      },
      removeItem: (id) => editItems((xs) => xs.filter((x) => x.soundId !== id)),
      moveItem: (id, by) =>
        editItems((xs) => {
          const i = xs.findIndex((x) => x.soundId === id);
          const j = i + by;
          if (i < 0 || j < 0 || j >= xs.length) return xs;
          const copy = [...xs];
          [copy[i], copy[j]] = [copy[j]!, copy[i]!];
          return copy;
        }),
      markSaved: (n) => setNow((cur) => (cur ? { ...cur, ...n, dirty: false } : cur)),
      applyDefaults: (d) => {
        if (defaultsApplied.current) return;
        defaultsApplied.current = true;
        if (statusRef.current !== "stopped") return;
        setVol(d.volume);
        setTimerState({ minutes: allowedTimer(d.timer), fade: d.fade && premium, endsAt: null });
      },
    }),
    [allowedTimer, close, editItems, error, fading, muted, now, play, premium, restart, setTimer, setVolume, start, status, stopNow, timer, toggle, toggleMute, volume],
  );

  // Lock screen / headphone controls where the browser supports them.
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    if (!now || status === "stopped") {
      ms.playbackState = "none";
      return;
    }
    try {
      ms.metadata = new MediaMetadata({ title: now.name, artist: "Sleep Sounds" });
      ms.playbackState = status === "playing" ? "playing" : "paused";
      ms.setActionHandler("play", () => void toggle());
      ms.setActionHandler("pause", () => void toggle());
      ms.setActionHandler("stop", () => stopNow());
    } catch {
      /* not supported */
    }
  }, [now, status, toggle, stopNow]);

  // If the page was asleep past the timer, stop when it wakes.
  useEffect(() => {
    const check = () => {
      if (timer.endsAt && Date.now() >= timer.endsAt && statusRef.current === "playing") stopNow();
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [timer.endsAt, stopNow]);

  // Clean up everything if the app shell goes away (sign out).
  useEffect(
    () => () => {
      clearTimers();
      soundEngine().stopAll(0.05);
    },
    [],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Re-render every second while a timer is running (only where it's shown). */
export function useCountdown(endsAt: number | null) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setT(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endsAt]);
  return endsAt && t ? Math.max(0, endsAt - t) : null;
}
