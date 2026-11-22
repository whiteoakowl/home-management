"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Lock, Pause, Pencil, Play, Plus, RotateCcw, Search, Share2, Square, Star, Trash2, Volume2, VolumeX, X } from "lucide-react";
import {
  clearRecentSounds,
  deleteSoundMix,
  duplicateSoundMix,
  renameSoundMix,
  saveSoundMix,
  saveSoundPreferences,
  shareSoundMix,
  toggleFavoriteMix,
  toggleFavoriteSound,
  type SoundResult,
} from "@/app/actions/sounds";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import {
  CATEGORY_FILTERS,
  FREE_TIMERS,
  formatRemaining,
  isFreeSound,
  PRESET_MIXES,
  presetById,
  searchSounds,
  soundById,
  SOUNDS,
  TIMER_OPTIONS,
  type CategoryFilter,
  type MixItem,
  type PresetMix,
  type RecentSound,
  type SoundDef,
} from "@/lib/sounds/catalog";
import { cn } from "@/lib/utils";
import { SoundBars } from "./mini-player";
import { isPlayingSound, useCountdown, usePlayer, type NowPlaying } from "./player";

export type MixView = { id: string; name: string; items: MixItem[]; isShared: boolean; allowEdits: boolean; mine: boolean; canEdit: boolean; ownerName: string | null };
export type SoundPrefsView = {
  defaultVolume: number;
  defaultTimer: number;
  fadeOut: boolean;
  preferredSound: string | null;
  favoriteSounds: string[];
  favoriteMixes: string[];
  recent: RecentSound[];
  reminderKind: string | null;
  reminderTime: string | null;
  reminderDays: number[];
};

const focus = "focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none";
const iconBtn = cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-sunken disabled:opacity-40", focus);
const chip = cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium ring-1 ring-line", focus);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mixLabel = (items: MixItem[]) => items.map((i) => soundById(i.soundId)?.name ?? "").filter(Boolean).join(" + ");

/** The Sleep Sounds tab: library, presets, favourites, mixes, the full player and settings. */
export function SoundsApp({ premium, prefs, mixes, upgradeHref }: { premium: boolean; prefs: SoundPrefsView; mixes: MixView[]; upgradeHref: string | null }) {
  const p = usePlayer();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CategoryFilter>("all");
  const [favSounds, setFavSounds] = useState(prefs.favoriteSounds);
  const [favMixes, setFavMixes] = useState(prefs.favoriteMixes);
  const [message, setMessage] = useState<string | null>(null);
  const [, start] = useTransition();
  // When fresh data arrives from the server, take it over the optimistic copy.
  const [seen, setSeen] = useState({ s: prefs.favoriteSounds, m: prefs.favoriteMixes });
  if (seen.s !== prefs.favoriteSounds || seen.m !== prefs.favoriteMixes) {
    setSeen({ s: prefs.favoriteSounds, m: prefs.favoriteMixes });
    setFavSounds(prefs.favoriteSounds);
    setFavMixes(prefs.favoriteMixes);
  }
  useEffect(() => p?.applyDefaults({ volume: prefs.defaultVolume, timer: prefs.defaultTimer, fade: prefs.fadeOut }), [p, prefs.defaultVolume, prefs.defaultTimer, prefs.fadeOut]);

  const act = (fn: () => Promise<SoundResult>, after?: (r: SoundResult) => void) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? null : r.message);
      after?.(r);
    });

  if (!p) return null;
  const locked = (id: string) => !premium && !isFreeSound(id);
  const mine = mixes.filter((m) => m.mine);
  const shared = mixes.filter((m) => !m.mine);

  const playSound = (s: SoundDef) => {
    if (locked(s.id)) return setMessage(`${s.name} is part of Premium.`);
    if (p.now?.kind === "sound" && p.now.refId === s.id && p.status !== "stopped") return void p.toggle();
    void p.play({ kind: "sound", refId: s.id, name: s.name, items: [{ soundId: s.id, volume: 100 }] });
  };
  const playPreset = (m: PresetMix) => {
    if (!premium) return setMessage("Preset mixes are part of Premium.");
    if (p.now?.kind === "preset" && p.now.refId === m.id && p.status !== "stopped") return void p.toggle();
    void p.play({ kind: "preset", refId: m.id, name: m.name, items: m.items });
  };
  const playMix = (m: MixView) => {
    if (p.now?.kind === "mix" && p.now.refId === m.id && p.status !== "stopped") return void p.toggle();
    void p.play({ kind: "mix", refId: m.id, name: m.ownerName ? `${m.ownerName}'s ${m.name}` : m.name, items: m.items, canEdit: m.canEdit });
  };
  const isNow = (kind: NowPlaying["kind"], id: string) => p.now?.kind === kind && p.now.refId === id && p.status === "playing";

  const toggleFav = (id: string) => {
    if (locked(id)) return setMessage("That sound is part of Premium.");
    setFavSounds((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    act(() => toggleFavoriteSound(id));
  };
  const toggleFavMix = (id: string) => {
    setFavMixes((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    act(() => toggleFavoriteMix(id));
  };

  const filtered = (() => {
    const base = searchSounds(query);
    if (cat === "all" || cat === "favorites" || cat === "mixes") return base;
    return base.filter((s) => s.categories.includes(cat));
  })();
  const presets = PRESET_MIXES.filter((m) => (cat === "all" ? true : m.categories.includes(cat as never)) && (!query || `${m.name} ${m.description} ${m.categories.join(" ")}`.toLowerCase().includes(query.toLowerCase())));
  const recent = prefs.recent
    .map((r) => (r.type === "sound" ? { r, sound: soundById(r.id) } : r.type === "preset" ? { r, preset: presetById(r.id) } : { r, mix: mixes.find((m) => m.id === r.id) }))
    .filter((x) => ("sound" in x && x.sound) || ("preset" in x && x.preset) || ("mix" in x && x.mix))
    .slice(0, 8);
  const preferred = prefs.preferredSound ? soundById(prefs.preferredSound) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        {preferred && !p.now && (
          <button type="button" onClick={() => playSound(preferred)} className={cn("flex items-center gap-4 rounded-[var(--radius-card)] bg-primary-600 px-5 py-4 text-left text-white shadow-[var(--shadow-card)] hover:bg-primary-700", focus)}>
            <span className="flex size-12 items-center justify-center rounded-full bg-white/15">
              <Play className="size-6" />
            </span>
            <span>
              <span className="block text-sm opacity-85">Your usual</span>
              <span className="text-xl font-semibold">Play {preferred.name}</span>
            </span>
          </button>
        )}

        <div className="flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Search sounds</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: rain, ocean, focus, sleep…"
              className={cn("h-12 w-full rounded-2xl border border-line-strong bg-surface pr-4 pl-10 text-[16px]", focus)}
            />
          </label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Categories">
            {CATEGORY_FILTERS.map((c) => (
              <button key={c.key} type="button" aria-pressed={cat === c.key} onClick={() => setCat(c.key)} className={cn(chip, cat === c.key ? "bg-primary-600 text-white ring-primary-600" : "bg-surface hover:bg-sunken")}>
                {c.key === "favorites" && <Star className="size-3.5" aria-hidden />}
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <p role="status" className="flex items-start justify-between gap-3 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
            <span>
              {message}{" "}
              {message.includes("Premium") && upgradeHref && (
                <Link href={upgradeHref} className="font-semibold underline">
                  See Premium
                </Link>
              )}
            </span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="shrink-0">
              <X className="size-4" />
            </button>
          </p>
        )}

        {cat === "all" && !query && recent.length > 0 && (
          <Section
            title="Recently used"
            action={
              <button type="button" onClick={() => act(() => clearRecentSounds())} className={cn("rounded-lg px-2 py-1 text-sm text-muted hover:bg-sunken", focus)}>
                Clear
              </button>
            }
          >
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {recent.map((x) => {
                const label = "sound" in x && x.sound ? x.sound.name : "preset" in x && x.preset ? x.preset.name : "mix" in x && x.mix ? x.mix.name : "";
                const emoji = "sound" in x && x.sound ? x.sound.emoji : "preset" in x && x.preset ? x.preset.emoji : "🎚️";
                const go = () => ("sound" in x && x.sound ? playSound(x.sound) : "preset" in x && x.preset ? playPreset(x.preset) : "mix" in x && x.mix ? playMix(x.mix) : undefined);
                return (
                  <button key={`${x.r.type}:${x.r.id}`} type="button" onClick={go} className={cn(chip, "bg-surface hover:bg-sunken")} aria-label={`Play ${label}`}>
                    <span aria-hidden>{emoji}</span> {label}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {(cat === "favorites" || (cat === "all" && !query && (favSounds.length > 0 || favMixes.length > 0))) && (
          <Section title="Favorites">
            {favSounds.length || favMixes.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {favSounds.map((id) => soundById(id)).filter((s): s is SoundDef => !!s).map((s) => (
                  <SoundCard key={s.id} s={s} active={isNow("sound", s.id) || isPlayingSound(p.now, p.status, s.id)} fav locked={locked(s.id)} premium={premium} onPlay={() => playSound(s)} onFav={() => toggleFav(s.id)} onMix={() => void p.addItem(s.id)} />
                ))}
                {mixes
                  .filter((m) => favMixes.includes(m.id))
                  .map((m) => (
                    <MixCard key={m.id} m={m} active={isNow("mix", m.id)} fav onPlay={() => playMix(m)} onFav={() => toggleFavMix(m.id)} />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Tap the star on any sound or mix to keep it here.</p>
            )}
          </Section>
        )}

        {(cat === "mixes" || (cat === "all" && !query)) && (
          <Section title="My mixes">
            {!premium ? (
              <p className="text-sm text-muted">
                Mix several sounds and save them (like Rain + Brown Noise) with Premium.{" "}
                {upgradeHref && (
                  <Link href={upgradeHref} className="font-medium text-primary-700 underline">
                    See Premium
                  </Link>
                )}
              </p>
            ) : mine.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {mine.map((m) => (
                  <MixCard
                    key={m.id}
                    m={m}
                    active={isNow("mix", m.id)}
                    fav={favMixes.includes(m.id)}
                    onPlay={() => playMix(m)}
                    onFav={() => toggleFavMix(m.id)}
                    onRename={(name) => act(() => renameSoundMix(m.id, name))}
                    onShare={(on, edits) => act(() => shareSoundMix(m.id, on, edits))}
                    onDuplicate={() => act(() => duplicateSoundMix({ mixId: m.id }))}
                    onDelete={() => {
                      if (confirm(`Delete "${m.name}"? This can't be undone.`)) act(() => deleteSoundMix(m.id), (r) => r.ok && p.now?.refId === m.id && p.close());
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Play a sound, add more with “+ Mix”, set each volume, then save it from the player.</p>
            )}
            {shared.length > 0 && (
              <>
                <h3 className="mt-5 mb-2 font-semibold">Shared by your household</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {shared.map((m) => (
                    <MixCard key={m.id} m={m} active={isNow("mix", m.id)} fav={favMixes.includes(m.id)} onPlay={() => playMix(m)} onFav={() => toggleFavMix(m.id)} onDuplicate={premium ? () => act(() => duplicateSoundMix({ mixId: m.id })) : undefined} />
                  ))}
                </div>
              </>
            )}
          </Section>
        )}

        {cat !== "favorites" && cat !== "mixes" && presets.length > 0 && (
          <Section title="Ready-made mixes">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {presets.map((m) => (
                <PresetCard
                  key={m.id}
                  m={m}
                  active={isNow("preset", m.id)}
                  locked={!premium}
                  onPlay={() => playPreset(m)}
                  onCopy={premium ? () => act(() => duplicateSoundMix({ presetId: m.id }), (r) => r.ok && setMessage(`Saved a copy of ${m.name} to My mixes.`)) : undefined}
                />
              ))}
            </div>
          </Section>
        )}

        {cat !== "favorites" && cat !== "mixes" && (
          <Section title={query ? `Sounds matching “${query}”` : "Sounds"}>
            {filtered.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((s) => (
                  <SoundCard key={s.id} s={s} active={isNow("sound", s.id) || isPlayingSound(p.now, p.status, s.id)} fav={favSounds.includes(s.id)} locked={locked(s.id)} premium={premium} onPlay={() => playSound(s)} onFav={() => toggleFav(s.id)} onMix={() => void p.addItem(s.id)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No sounds match. Try “rain”, “noise” or “focus”.</p>
            )}
          </Section>
        )}

        <SettingsCard prefs={prefs} premium={premium} onSave={(x) => act(() => saveSoundPreferences(x), (r) => r.ok && setMessage("Settings saved."))} />

        <p className="rounded-2xl bg-sunken/70 px-4 py-3 text-sm text-ink-soft">
          Use comfortable listening levels and take breaks when appropriate. If using sound around sleeping children, keep the volume low and the device away from the crib or bed, and follow current hearing-safety guidance. Sleep Sounds is for relaxation and background sound; it isn&apos;t a medical treatment. Playback with the screen locked or the app in the background depends on your phone and browser.
        </p>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <NowPlayingPanel premium={premium} mixes={mixes} onMessage={setMessage} />
      </aside>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StarButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={on ? `Remove ${label} from favorites` : `Add ${label} to favorites`} className={cn(iconBtn, on && "text-sunflower-600")}>
      <Star className={cn("size-5", on && "fill-current")} />
    </button>
  );
}

function PlayButton({ active, label, onClick, disabled }: { active: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? `Pause ${label}` : `Play ${label}`}
      aria-disabled={disabled}
      className={cn("inline-flex h-11 min-w-24 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold", active ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-700 hover:bg-primary-100", disabled && "opacity-60", focus)}
    >
      {disabled ? <Lock className="size-4" aria-hidden /> : active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      {active ? "Pause" : "Play"}
    </button>
  );
}

function SoundCard({ s, active, fav, locked, premium, onPlay, onFav, onMix }: { s: SoundDef; active: boolean; fav: boolean; locked: boolean; premium: boolean; onPlay: () => void; onFav: () => void; onMix: () => void }) {
  return (
    <article className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--shadow-card)] transition-colors", active ? "border-primary-400 ring-2 ring-primary-200" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-2xl" aria-hidden>
          {s.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 leading-tight font-semibold">
            {s.name}
            {locked && (
              <Badge tone="primary">
                <Lock className="size-3" aria-hidden /> Premium
              </Badge>
            )}
            {active && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700">
                <SoundBars on className="h-3 text-primary-600" /> Playing
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{s.blurb}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1">
        <PlayButton active={active} label={s.name} onClick={onPlay} disabled={locked} />
        <span className="flex-1" />
        {premium && (
          <button type="button" onClick={onMix} className={cn("inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-ink-soft hover:bg-sunken", focus)} aria-label={`Add ${s.name} to the mix`}>
            <Plus className="size-4" aria-hidden /> Mix
          </button>
        )}
        {!locked && <StarButton on={fav} label={s.name} onClick={onFav} />}
      </div>
    </article>
  );
}

function PresetCard({ m, active, locked, onPlay, onCopy }: { m: PresetMix; active: boolean; locked: boolean; onPlay: () => void; onCopy?: () => void }) {
  return (
    <article className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border bg-gradient-to-br from-primary-50/60 to-surface p-4 shadow-[var(--shadow-card)]", active ? "border-primary-400 ring-2 ring-primary-200" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {m.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {m.name}
            {locked && (
              <Badge tone="primary">
                <Lock className="size-3" aria-hidden /> Premium
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted">{m.description}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1">
        <PlayButton active={active} label={m.name} onClick={onPlay} disabled={locked} />
        <span className="flex-1" />
        {onCopy && (
          <button type="button" onClick={onCopy} className={cn("inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-ink-soft hover:bg-sunken", focus)} aria-label={`Save my own copy of ${m.name}`}>
            <Copy className="size-4" aria-hidden /> Save a copy
          </button>
        )}
      </div>
    </article>
  );
}

function MixCard({
  m,
  active,
  fav,
  onPlay,
  onFav,
  onRename,
  onShare,
  onDuplicate,
  onDelete,
}: {
  m: MixView;
  active: boolean;
  fav: boolean;
  onPlay: () => void;
  onFav: () => void;
  onRename?: (name: string) => void;
  onShare?: (on: boolean, edits: boolean) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(m.name);
  const title = m.ownerName ? `${m.ownerName}'s ${m.name}` : m.name;
  return (
    <article className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--shadow-card)]", active ? "border-primary-400 ring-2 ring-primary-200" : "border-line")}>
      <div className="min-w-0">
        {renaming && onRename ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onRename(name);
              setRenaming(false);
            }}
          >
            <label className="sr-only" htmlFor={`rename-${m.id}`}>
              Mix name
            </label>
            <input id={`rename-${m.id}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={cn("h-11 min-w-0 flex-1 rounded-xl border border-line-strong px-3", focus)} autoFocus />
            <button type="submit" className={cn("h-11 rounded-xl bg-primary-600 px-3 text-sm font-semibold text-white", focus)}>
              Save
            </button>
          </form>
        ) : (
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            🎚️ {title}
            {m.isShared && m.mine && (
              <Badge tone="olive">
                <Share2 className="size-3" aria-hidden /> Shared{m.allowEdits ? ", others can edit" : ""}
              </Badge>
            )}
          </h3>
        )}
        <p className="mt-0.5 text-sm text-muted">{mixLabel(m.items)}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1">
        <PlayButton active={active} label={title} onClick={onPlay} />
        <span className="flex-1" />
        <StarButton on={fav} label={title} onClick={onFav} />
        {onRename && (
          <button type="button" onClick={() => setRenaming((r) => !r)} className={iconBtn} aria-label={`Rename ${m.name}`}>
            <Pencil className="size-4" />
          </button>
        )}
        {onDuplicate && (
          <button type="button" onClick={onDuplicate} className={iconBtn} aria-label={`Duplicate ${title}`}>
            <Copy className="size-4" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className={cn(iconBtn, "hover:bg-wine-50 hover:text-wine-500")} aria-label={`Delete ${m.name}`}>
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {onShare && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-2 text-sm">
          <label className="flex min-h-9 items-center gap-2">
            <input type="checkbox" checked={m.isShared} onChange={(e) => onShare(e.target.checked, m.allowEdits)} className="size-5 accent-[var(--color-primary-600)]" />
            Share with household
          </label>
          {m.isShared && (
            <label className="flex min-h-9 items-center gap-2 text-muted">
              <input type="checkbox" checked={m.allowEdits} onChange={(e) => onShare(true, e.target.checked)} className="size-5 accent-[var(--color-primary-600)]" />
              Let others change the sounds
            </label>
          )}
        </div>
      )}
    </article>
  );
}

function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      aria-valuetext={`${value}%`}
      className={cn("range-sound w-full", focus)}
    />
  );
}

/** The big player: controls, volume, sleep timer and the mixer. */
function NowPlayingPanel({ premium, mixes, onMessage }: { premium: boolean; mixes: MixView[]; onMessage: (m: string | null) => void }) {
  const p = usePlayer()!;
  const remaining = useCountdown(p.timer.endsAt);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [share, setShare] = useState(false);
  const [pending, start] = useTransition();
  const [addId, setAddId] = useState("");
  const now = p.now;
  const playing = p.status === "playing";
  const timerOptions = TIMER_OPTIONS.filter((t) => premium || FREE_TIMERS.includes(t.minutes));
  const isCustom = p.timer.minutes > 0 && !TIMER_OPTIONS.some((t) => t.minutes === p.timer.minutes);
  const savedMix = now?.kind === "mix" ? mixes.find((m) => m.id === now.refId) : null;

  const save = (asNew: boolean) =>
    start(async () => {
      if (!now) return;
      const r = await saveSoundMix({ id: asNew ? null : (savedMix?.id ?? null), name: asNew || !savedMix ? name || now.name : savedMix.name, items: now.items, isShared: asNew || !savedMix ? share : savedMix.isShared, allowEdits: savedMix?.allowEdits ?? false });
      if (!r.ok) return onMessage(r.message);
      onMessage(asNew || !savedMix ? `Saved “${name || now.name}” to My mixes.` : "Mix saved.");
      p.markSaved(r.id ? { kind: "mix", refId: r.id, name: asNew || !savedMix ? name || now.name : now.name, canEdit: true } : {});
      setSaving(false);
    });

  return (
    <Card className="flex flex-col gap-5" aria-label="Now playing">
      <CardHeader title="Now playing" />
      {!now ? (
        <p className="text-sm text-muted">Pick a sound or a ready-made mix to start. It keeps playing while you use the rest of the app.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <SoundBars on={playing && !p.fading} className="h-8 text-primary-600" />
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{now.name}</p>
              <p className="text-sm text-muted" aria-live="polite">
                {p.fading ? "Fading out…" : playing ? "Playing" : p.status === "paused" ? "Paused" : "Stopped"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => void p.restart()} className={iconBtn} aria-label="Restart">
              <RotateCcw className="size-5" />
            </button>
            <button type="button" onClick={() => void p.toggle()} className={cn("inline-flex size-16 items-center justify-center rounded-full bg-primary-600 text-white shadow-[var(--shadow-card)] hover:bg-primary-700", focus)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="size-7" /> : <Play className="size-7" />}
            </button>
            <button type="button" onClick={p.stop} disabled={p.status === "stopped"} className={iconBtn} aria-label="Stop">
              <Square className="size-5" />
            </button>
            <button type="button" onClick={p.close} className={iconBtn} aria-label="Close player">
              <X className="size-5" />
            </button>
          </div>
        </>
      )}

      {p.error && (
        <p role="alert" className="text-sm text-wine-600">
          {p.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={p.toggleMute} className={iconBtn} aria-pressed={p.muted} aria-label={p.muted ? "Unmute" : "Mute"}>
          {p.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
        <Slider label="Volume" value={p.volume} onChange={p.setVolume} />
        <span className="w-11 text-right text-sm tabular-nums">{p.muted ? "Muted" : `${p.volume}%`}</span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink-soft">Sleep timer</legend>
        <select
          value={isCustom ? "custom" : String(p.timer.minutes)}
          onChange={(e) => (e.target.value === "custom" ? setCustom(String(p.timer.minutes || 20)) : p.setTimer(Number(e.target.value)))}
          className={cn("h-11 rounded-xl border border-line-strong bg-surface px-3", focus)}
          aria-label="Sleep timer length"
        >
          <option value="0">Keep playing (no timer)</option>
          {timerOptions.map((t) => (
            <option key={t.minutes} value={t.minutes}>
              {t.label}
            </option>
          ))}
          {premium && <option value="custom">{isCustom ? `Custom: ${p.timer.minutes} min` : "Custom…"}</option>}
        </select>
        {premium && (custom || isCustom) && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const m = Math.round(Number(custom));
              if (m >= 1 && m <= 720) {
                p.setTimer(m);
                setCustom("");
              }
            }}
          >
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Minutes (1–720)
              <input type="number" inputMode="numeric" min={1} max={720} value={custom} onChange={(e) => setCustom(e.target.value)} className={cn("h-11 rounded-xl border border-line-strong px-3", focus)} />
            </label>
            <button type="submit" className={cn("h-11 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white", focus)}>
              Set
            </button>
          </form>
        )}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="When the timer ends">
          {[
            { v: true, l: "Fade out" },
            { v: false, l: "Stop immediately" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              role="radio"
              aria-checked={p.timer.fade === o.v}
              disabled={o.v && !premium}
              onClick={() => p.setTimer(p.timer.minutes, o.v)}
              className={cn(chip, p.timer.fade === o.v ? "bg-primary-50 text-primary-700 ring-primary-300" : "bg-surface hover:bg-sunken", "disabled:opacity-50")}
            >
              {o.l}
              {o.v && !premium && <Lock className="size-3" aria-label="Premium" />}
            </button>
          ))}
        </div>
        {playing && remaining !== null ? (
          <div>
            <p className="text-sm font-medium" aria-live="off">
              Stops in <span className="tabular-nums">{formatRemaining(remaining)}</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Sleep timer" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 - (remaining / (p.timer.minutes * 60_000)) * 100)}>
              <div className="h-full rounded-full bg-primary-500 transition-[width] duration-1000 motion-reduce:transition-none" style={{ width: `${100 - (remaining / (p.timer.minutes * 60_000)) * 100}%` }} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">{p.timer.minutes ? "The timer starts when you press Play." : "Plays until you stop it."}</p>
        )}
      </fieldset>

      {now && premium && (
        <section aria-label="Mixer" className="flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="font-semibold">Mixer</h3>
          <ul className="flex flex-col gap-3">
            {now.items.map((i, idx) => {
              const s = soundById(i.soundId);
              if (!s) return null;
              return (
                <li key={i.soundId} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {s.emoji} {s.name} <span className="text-muted tabular-nums">{i.muted ? "· muted" : `· ${i.volume}%`}</span>
                    </span>
                    <button type="button" onClick={() => p.moveItem(i.soundId, -1)} disabled={idx === 0} className={cn(iconBtn, "size-9")} aria-label={`Move ${s.name} up`}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" onClick={() => p.moveItem(i.soundId, 1)} disabled={idx === now.items.length - 1} className={cn(iconBtn, "size-9")} aria-label={`Move ${s.name} down`}>
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => p.toggleItemMute(i.soundId)} aria-pressed={!!i.muted} className={cn(iconBtn, "size-9")} aria-label={i.muted ? `Unmute ${s.name}` : `Mute ${s.name}`}>
                      {i.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>
                    <button type="button" onClick={() => p.removeItem(i.soundId)} disabled={now.items.length === 1} className={cn(iconBtn, "size-9 hover:text-wine-500")} aria-label={`Remove ${s.name} from the mix`}>
                      <X className="size-4" />
                    </button>
                  </div>
                  <Slider label={`${s.name} volume`} value={i.volume} onChange={(v) => p.setItemVolume(i.soundId, v)} disabled={i.muted} />
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <select value={addId} onChange={(e) => setAddId(e.target.value)} className={cn("h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3", focus)} aria-label="Sound to add">
              <option value="">Add a sound…</option>
              {SOUNDS.filter((s) => !now.items.some((i) => i.soundId === s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addId || now.items.length >= 8}
              onClick={() => {
                void p.addItem(addId);
                setAddId("");
              }}
              className={cn("h-11 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-50", focus)}
            >
              Add
            </button>
          </div>

          {savedMix?.canEdit && now.dirty && !saving ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => save(false)} className={cn("h-11 flex-1 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white", focus)}>
                Save changes
              </button>
              <button type="button" onClick={() => (setName(`${now.name} copy`), setSaving(true))} className={cn("h-11 rounded-xl px-4 text-sm font-medium ring-1 ring-line hover:bg-sunken", focus)}>
                Save as new
              </button>
            </div>
          ) : !saving && (now.kind !== "mix" || now.dirty || !savedMix?.canEdit) ? (
            <button type="button" onClick={() => (setName(now.kind === "sound" ? `My ${now.name}` : now.name), setSaving(true))} className={cn("h-11 rounded-xl px-4 text-sm font-semibold ring-1 ring-primary-300 text-primary-700 hover:bg-primary-50", focus)}>
              Save as my mix
            </button>
          ) : null}
          {saving && (
            <form
              className="flex flex-col gap-2 rounded-xl bg-sunken/60 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                save(true);
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Mix name
                <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required className={cn("h-11 rounded-xl border border-line-strong bg-surface px-3 font-normal", focus)} placeholder="Rainy Night, Study Time…" autoFocus />
              </label>
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-5 accent-[var(--color-primary-600)]" />
                Share with household
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className={cn("h-11 flex-1 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white", focus)}>
                  Save mix
                </button>
                <button type="button" onClick={() => setSaving(false)} className={cn("h-11 rounded-xl px-4 text-sm ring-1 ring-line", focus)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </Card>
  );
}

function SettingsCard({ prefs, premium, onSave }: { prefs: SoundPrefsView; premium: boolean; onSave: (x: Parameters<typeof saveSoundPreferences>[0]) => void }) {
  const [vol, setVol] = useState(prefs.defaultVolume);
  const [timer, setTimer] = useState(String(prefs.defaultTimer));
  const [fade, setFade] = useState(prefs.fadeOut && premium);
  const [preferred, setPreferred] = useState(prefs.preferredSound ?? "");
  const [rTime, setRTime] = useState(prefs.reminderTime?.slice(0, 5) ?? "");
  const [rKind, setRKind] = useState(prefs.reminderKind ?? "bedtime");
  const [rDays, setRDays] = useState<number[]>(prefs.reminderDays);
  const timerOptions = TIMER_OPTIONS.filter((t) => premium || FREE_TIMERS.includes(t.minutes));
  const field = cn("h-11 rounded-xl border border-line-strong bg-surface px-3", focus);
  return (
    <details className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <summary className={cn("cursor-pointer rounded-lg text-lg font-semibold", focus)}>My Sleep Sounds settings</summary>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ defaultVolume: vol, defaultTimer: Number(timer), fadeOut: fade, preferredSound: preferred || null, reminderTime: rTime || null, reminderKind: rKind, reminderDays: rDays });
        }}
      >
        <p className="text-sm text-muted">Just for you. Nobody else&apos;s settings change.</p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Starting volume: {vol}%
          <Slider label="Starting volume" value={vol} onChange={setVol} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Default timer
            <select value={timer} onChange={(e) => setTimer(e.target.value)} className={field}>
              <option value="0">Keep playing</option>
              {timerOptions.map((t) => (
                <option key={t.minutes} value={t.minutes}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            My usual sound
            <select value={preferred} onChange={(e) => setPreferred(e.target.value)} className={field}>
              <option value="">None</option>
              {SOUNDS.filter((s) => premium || s.free).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={fade} disabled={!premium} onChange={(e) => setFade(e.target.checked)} className="size-5 accent-[var(--color-primary-600)]" />
          Fade out gently when the timer ends {!premium && <span className="text-muted">(Premium)</span>}
        </label>
        <fieldset className="flex flex-col gap-2 rounded-xl bg-sunken/60 p-3">
          <legend className="text-sm font-medium">Reminder (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Remind me to
              <select value={rKind} onChange={(e) => setRKind(e.target.value)} className={field}>
                <option value="bedtime">Get ready for bed</option>
                <option value="relax">Take a relaxation break</option>
                <option value="meditation">Meditate</option>
                <option value="routine">Start my sleep routine</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              At (leave empty for no reminder)
              <input type="time" value={rTime} onChange={(e) => setRTime(e.target.value)} className={field} />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reminder days (none = every day)">
            {DAYS.map((d, i) => (
              <button key={d} type="button" aria-pressed={rDays.includes(i)} onClick={() => setRDays((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]))} className={cn("h-10 min-w-12 rounded-full px-3 text-sm ring-1 ring-line", rDays.includes(i) ? "bg-primary-600 text-white ring-primary-600" : "bg-surface", focus)}>
                {d}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">No days picked means every day. Sent through your usual notifications.</p>
        </fieldset>
        <button type="submit" className={cn("h-11 self-start rounded-xl bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700", focus)}>
          Save settings
        </button>
      </form>
    </details>
  );
}
