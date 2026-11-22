/**
 * Sleep Sounds: the library, presets, timer options and the validation the
 * server uses for anything saved. Pure module (no DB, no browser APIs), so it
 * runs on the server, in the browser and in tests.
 *
 * Every sound is generated in the browser (src/lib/sounds/engine.ts); there
 * are no audio files, so nothing is downloaded or stored.
 */
import type { MixItem, RecentSound } from "@/db/schema/sounds";

export type { MixItem, RecentSound };

export type SoundCategory = "noise" | "nature" | "ambient" | "relaxation" | "sleep" | "focus" | "meditation";

export type SoundDef = {
  id: string;
  name: string;
  emoji: string;
  categories: SoundCategory[];
  /** Words people might search for. */
  tags: string[];
  /** Included on the Free plan. */
  free?: boolean;
  blurb: string;
};

export const SOUNDS: SoundDef[] = [
  { id: "white", name: "White Noise", emoji: "⚪", categories: ["noise", "sleep", "focus"], tags: ["static", "hiss", "noise"], free: true, blurb: "Even, bright hiss across every frequency." },
  { id: "pink", name: "Pink Noise", emoji: "🌸", categories: ["noise", "sleep", "focus"], tags: ["noise", "soft"], blurb: "Softer than white noise, like steady rain." },
  { id: "brown", name: "Brown Noise", emoji: "🟤", categories: ["noise", "sleep", "focus"], tags: ["deep", "noise", "rumble", "low"], free: true, blurb: "Deep, low rumble. A favourite for sleep and focus." },
  { id: "rain", name: "Rain", emoji: "🌧️", categories: ["nature", "sleep", "relaxation"], tags: ["rain", "storm", "water", "drops"], free: true, blurb: "Steady rainfall with drops on the roof." },
  { id: "heavy-rain", name: "Heavy Rain", emoji: "⛈️", categories: ["nature", "sleep"], tags: ["rain", "downpour", "storm", "water"], blurb: "A full downpour." },
  { id: "gentle-rain", name: "Gentle Rain", emoji: "🌦️", categories: ["nature", "sleep", "relaxation"], tags: ["rain", "soft", "drizzle", "water"], blurb: "Light, soft rain." },
  { id: "thunderstorm", name: "Thunderstorm", emoji: "🌩️", categories: ["nature", "sleep"], tags: ["rain", "thunder", "storm"], blurb: "Heavy rain with rolling thunder." },
  { id: "thunder", name: "Distant Thunder", emoji: "☁️", categories: ["nature"], tags: ["thunder", "storm", "rumble"], blurb: "Far-off thunder now and then. Lovely in a mix with rain." },
  { id: "ocean", name: "Ocean Waves", emoji: "🌊", categories: ["nature", "sleep", "relaxation"], tags: ["ocean", "sea", "waves", "beach", "water"], free: true, blurb: "Waves rolling in and out." },
  { id: "gentle-ocean", name: "Gentle Ocean", emoji: "🏝️", categories: ["nature", "sleep", "relaxation", "meditation"], tags: ["ocean", "sea", "waves", "calm", "water"], blurb: "Slow, quiet waves." },
  { id: "river", name: "River", emoji: "🏞️", categories: ["nature", "relaxation", "focus"], tags: ["river", "stream", "creek", "water", "brook"], blurb: "A babbling stream." },
  { id: "waterfall", name: "Waterfall", emoji: "💦", categories: ["nature", "focus"], tags: ["waterfall", "water", "rush"], blurb: "Rushing, steady water." },
  { id: "fireplace", name: "Fireplace", emoji: "🔥", categories: ["ambient", "relaxation"], tags: ["fire", "crackle", "cozy", "fireplace"], blurb: "A crackling fire indoors." },
  { id: "campfire", name: "Campfire", emoji: "🏕️", categories: ["ambient", "nature"], tags: ["fire", "camp", "crackle", "outdoors"], blurb: "Crackling campfire under the night sky." },
  { id: "fan", name: "Fan", emoji: "🌀", categories: ["ambient", "sleep", "focus"], tags: ["fan", "hum", "whir"], free: true, blurb: "The steady whir of a box fan." },
  { id: "ac", name: "Air Conditioner", emoji: "❄️", categories: ["ambient", "sleep", "focus"], tags: ["ac", "air conditioner", "hum", "air"], blurb: "Low air-conditioner hum." },
  { id: "wind", name: "Gentle Wind", emoji: "🍃", categories: ["nature", "relaxation"], tags: ["wind", "breeze", "air"], blurb: "A soft breeze rising and falling." },
  { id: "forest", name: "Forest", emoji: "🌲", categories: ["nature", "relaxation", "meditation"], tags: ["forest", "woods", "trees", "leaves", "birds"], blurb: "Rustling leaves, a breeze and the odd bird." },
  { id: "birds", name: "Birds", emoji: "🐦", categories: ["nature"], tags: ["birds", "birdsong", "morning", "chirp"], blurb: "Morning birdsong." },
  { id: "night", name: "Night Sounds", emoji: "🌙", categories: ["nature", "sleep"], tags: ["night", "crickets", "summer", "evening"], blurb: "A warm summer night: crickets and a light breeze." },
  { id: "crickets", name: "Crickets", emoji: "🦗", categories: ["nature", "sleep"], tags: ["crickets", "night", "summer"], blurb: "Crickets chirping." },
  { id: "heartbeat", name: "Soft Heartbeat-style Rhythm", emoji: "💗", categories: ["relaxation", "sleep"], tags: ["heartbeat", "rhythm", "pulse", "calm"], blurb: "A slow, soft, steady pulse." },
  { id: "ambient-noise", name: "Gentle Ambient Noise", emoji: "🌫️", categories: ["ambient", "sleep", "focus"], tags: ["ambient", "soft", "noise", "background"], blurb: "A soft, warm background hush." },
  { id: "ambient", name: "Gentle Ambient", emoji: "✨", categories: ["relaxation", "meditation"], tags: ["ambient", "pad", "music", "calm", "relax"], blurb: "A slow, warm, floating tone." },
  { id: "drone", name: "Calm Drone", emoji: "🎐", categories: ["relaxation", "meditation", "focus"], tags: ["drone", "tone", "hum", "calm"], blurb: "A deep, steady tone that slowly shifts." },
  { id: "meditation", name: "Meditation Ambience", emoji: "🧘", categories: ["meditation", "relaxation"], tags: ["meditation", "bell", "singing bowl", "calm", "mindfulness"], blurb: "Soft tones with a gentle bell now and then." },
];

const BY_ID = new Map(SOUNDS.map((s) => [s.id, s]));
export const soundById = (id: string) => BY_ID.get(id);
export const isSoundId = (id: unknown): id is string => typeof id === "string" && BY_ID.has(id);
export const isFreeSound = (id: string) => !!BY_ID.get(id)?.free;

export const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "sleep", label: "Sleep" },
  { key: "noise", label: "Noise" },
  { key: "nature", label: "Nature" },
  { key: "ambient", label: "Ambient" },
  { key: "relaxation", label: "Relaxation" },
  { key: "focus", label: "Focus" },
  { key: "meditation", label: "Meditation" },
  { key: "favorites", label: "Favorites" },
  { key: "mixes", label: "My Mixes" },
] as const;
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number]["key"];

/** Search by name, category or tag ("rain", "focus", "sleep", "fire"…). */
export function searchSounds(query: string, list: SoundDef[] = SOUNDS) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const words = q.split(/\s+/);
  return list.filter((s) => {
    const hay = `${s.name} ${s.categories.join(" ")} ${s.tags.join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export type PresetMix = { id: string; name: string; emoji: string; description: string; items: MixItem[]; categories: SoundCategory[] };

export const PRESET_MIXES: PresetMix[] = [
  { id: "deep-sleep", name: "Deep Sleep", emoji: "😴", description: "Brown noise with steady rain", categories: ["sleep"], items: [{ soundId: "brown", volume: 55 }, { soundId: "rain", volume: 45 }] },
  { id: "rainy-night", name: "Rainy Night", emoji: "🌧️", description: "Rain with distant thunder", categories: ["sleep", "nature"], items: [{ soundId: "rain", volume: 60 }, { soundId: "thunder", volume: 25 }, { soundId: "brown", volume: 25 }] },
  { id: "ocean-calm", name: "Ocean Calm", emoji: "🌊", description: "Ocean waves and a gentle wind", categories: ["sleep", "relaxation"], items: [{ soundId: "ocean", volume: 60 }, { soundId: "wind", volume: 25 }] },
  { id: "cozy-evening", name: "Cozy Evening", emoji: "🔥", description: "A crackling fire while it rains", categories: ["relaxation"], items: [{ soundId: "fireplace", volume: 60 }, { soundId: "gentle-rain", volume: 40 }] },
  { id: "focus", name: "Focus", emoji: "🎯", description: "Brown noise and a fan", categories: ["focus"], items: [{ soundId: "brown", volume: 55 }, { soundId: "fan", volume: 35 }] },
  { id: "forest-walk", name: "Forest", emoji: "🌲", description: "Forest, wind and birds", categories: ["nature", "relaxation"], items: [{ soundId: "forest", volume: 55 }, { soundId: "wind", volume: 25 }, { soundId: "birds", volume: 30 }] },
  { id: "meditation", name: "Meditation", emoji: "🧘", description: "Gentle ambient tones over the ocean", categories: ["meditation"], items: [{ soundId: "ambient", volume: 45 }, { soundId: "gentle-ocean", volume: 40 }] },
  { id: "reading", name: "Reading", emoji: "📖", description: "Fireplace and soft rain", categories: ["relaxation", "focus"], items: [{ soundId: "fireplace", volume: 50 }, { soundId: "gentle-rain", volume: 35 }] },
  { id: "summer-night", name: "Summer Night", emoji: "🌙", description: "Crickets, a breeze and a soft hush", categories: ["sleep", "nature"], items: [{ soundId: "night", volume: 55 }, { soundId: "ambient-noise", volume: 25 }] },
  { id: "afternoon-nap", name: "Afternoon Nap", emoji: "🛋️", description: "Air conditioner and pink noise", categories: ["sleep"], items: [{ soundId: "ac", volume: 50 }, { soundId: "pink", volume: 30 }] },
];
export const presetById = (id: string) => PRESET_MIXES.find((p) => p.id === id);

/** Sleep-timer choices in minutes (0 = keep playing until stopped). */
export const TIMER_OPTIONS = [
  { minutes: 5, label: "5 min" },
  { minutes: 10, label: "10 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "60 min" },
  { minutes: 90, label: "90 min" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
];
/** Timers on the Free plan. Everything else (and custom times) is Premium. */
export const FREE_TIMERS = [15, 30, 60];
export const MAX_TIMER_MINUTES = 12 * 60;

export const MAX_MIX_ITEMS = 8;
export const RECENT_LIMIT = 10;
export const MAX_MIX_NAME = 60;

export const clampVolume = (v: unknown, fallback = 60) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;
};

/**
 * Clean mix items from the browser: known sounds only, each once, volumes 0–100,
 * at most MAX_MIX_ITEMS. On the Free plan only free sounds are kept.
 */
export function sanitizeMixItems(raw: unknown, opts: { premium: boolean }): MixItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: MixItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const soundId = (r as { soundId?: unknown }).soundId;
    if (!isSoundId(soundId) || seen.has(soundId)) continue;
    if (!opts.premium && !isFreeSound(soundId)) continue;
    seen.add(soundId);
    out.push({ soundId, volume: clampVolume((r as { volume?: unknown }).volume), ...((r as { muted?: unknown }).muted === true ? { muted: true } : {}) });
    if (out.length >= MAX_MIX_ITEMS) break;
  }
  return out;
}

export const cleanMixName = (v: unknown) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, MAX_MIX_NAME)
    : "";

/** Add an item to the front of the recently-played list, without duplicates, capped. */
export function pushRecent(list: RecentSound[], item: Omit<RecentSound, "at">, at: string): RecentSound[] {
  const rest = (Array.isArray(list) ? list : []).filter((r) => !(r && r.type === item.type && r.id === item.id));
  return [{ ...item, at }, ...rest].slice(0, RECENT_LIMIT);
}

/** May this person change a mix? Only its owner, or anyone in the household when it's shared with editing allowed. */
export function canEditMix(viewer: { familyId: string; memberId: string }, mix: { familyId: string; memberId: string; isShared: boolean; allowEdits: boolean }) {
  if (mix.familyId !== viewer.familyId) return false;
  return mix.memberId === viewer.memberId || (mix.isShared && mix.allowEdits);
}

/** May this person see (play, favourite, duplicate) a mix? Their own, or one shared in their household. */
export function canSeeMix(viewer: { familyId: string; memberId: string }, mix: { familyId: string; memberId: string; isShared: boolean }) {
  return mix.familyId === viewer.familyId && (mix.memberId === viewer.memberId || mix.isShared);
}

/** Seconds of fade-out for a timer of `minutes` (gentle, never more than a minute). */
export const fadeSecondsFor = (minutes: number) => Math.max(5, Math.min(60, Math.round(minutes * 60 * 0.1)));

/** Perceived loudness: 0–100 slider → gain (squared, so the low end is gentle). */
export const sliderToGain = (v: number) => Math.pow(Math.min(100, Math.max(0, v)) / 100, 2);

/** "1:02:05", "4:09" for a remaining timer. */
export function formatRemaining(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
