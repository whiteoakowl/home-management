/** Family Hub helpers safe for client components (no database imports). */
export const CONTACT_CATEGORIES = ["family", "friends", "school", "medical", "childcare", "neighbors", "services", "work", "other"] as const;
export const CONTACT_LABEL: Record<string, string> = {
  family: "Family & relatives",
  friends: "Friends",
  school: "School & teachers",
  medical: "Doctors & health",
  childcare: "Babysitters & childcare",
  neighbors: "Neighbors",
  services: "Home services",
  work: "Work",
  other: "Other",
};

/** Next occurrence (this year or next) of a yyyy-mm-dd birthday, on or after today. */
export function nextBirthday(birthday: string, today: string) {
  const md = birthday.slice(5);
  const y = Number(today.slice(0, 4));
  const fix = (yy: number) => (md === "02-29" && !(yy % 4 === 0 && (yy % 100 !== 0 || yy % 400 === 0)) ? `${yy}-02-28` : `${yy}-${md}`);
  const thisYear = fix(y);
  return thisYear >= today ? thisYear : fix(y + 1);
}

/** Wishlist priorities. */
export const PRIORITY: Record<number, string> = { 1: "Really want", 2: "Would love", 3: "Nice to have" };

// ─── Family Chat ─────────────────────────────────────────────────────────────

export type Channel = "all" | "parents" | "kids" | "announcements";
export const CHANNELS: { key: Channel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "parents", label: "Parents" },
  { key: "kids", label: "Kids" },
  { key: "announcements", label: "Announcements" },
];
/** Who can read a chat: Parents is parents only; everything else is the whole family (parents can read Kids). */
export const canSeeChannel = (isParent: boolean, c: string) => c === "all" || c === "kids" || c === "announcements" || (c === "parents" && isParent);
/** Who can write: Announcements and Parents are for parents. */
export const canPostChannel = (isParent: boolean, c: string) => c === "all" || c === "kids" || isParent;
export const visibleChannels = (isParent: boolean) => CHANNELS.filter((c) => canSeeChannel(isParent, c.key)).map((c) => c.key);

/** Quick reactions offered on every message. */
export const REACTIONS = ["❤️", "👍", "😂", "😮", "🎉", "🙏"];
/** The emoji picker in the message box. */
export const EMOJI = ["😀", "😂", "😊", "😍", "🥰", "😎", "🤔", "😴", "😢", "😡", "👍", "👏", "🙏", "💪", "❤️", "🎉", "✅", "⭐", "🔥", "🌮", "🍕", "🍓", "🌶️", "☕", "🏀", "⚽", "🩰", "🚗", "🏠", "🐶", "🎂", "🎁"];
