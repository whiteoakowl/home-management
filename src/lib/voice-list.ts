/**
 * Turns a spoken phrase into list items: "I need milk, eggs and two pounds of
 * apples" → ["milk", "eggs", "2 lb apples"]. Pure, so it's tested
 * (tests/voice-list.test.ts) and runs in the browser.
 */

/** Things that contain "and" but are one item. */
const KEEP_TOGETHER = [
  "mac and cheese",
  "macaroni and cheese",
  "salt and pepper",
  "peanut butter and jelly",
  "pb and j",
  "fish and chips",
  "half and half",
  "chips and salsa",
  "rice and beans",
  "sweet and sour",
  "cookies and cream",
  "bread and butter",
  "pork and beans",
  "franks and beans",
  "spaghetti and meatballs",
  "salt and vinegar",
  "sour cream and onion",
  "shampoo and conditioner",
  "oil and vinegar",
  "ham and cheese",
  "egg and cheese",
  "ranch and",
];

const NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  half: 0.5,
  couple: 2,
};

const UNITS: [RegExp, string][] = [
  [/^pounds?$|^lbs?$/, "lb"],
  [/^ounces?$|^oz$/, "oz"],
  [/^gallons?$/, "gal"],
  [/^quarts?$/, "qt"],
  [/^pints?$/, "pt"],
  [/^liters?$|^litres?$/, "L"],
  [/^kilos?$|^kilograms?$/, "kg"],
  [/^grams?$/, "g"],
  [/^dozens?$/, "dozen"],
  [/^cans?$/, "can"],
  [/^jars?$/, "jar"],
  [/^bottles?$/, "bottle"],
  [/^boxe?s?$/, "box"],
  [/^bags?$/, "bag"],
  [/^packs?$|^packages?$/, "pack"],
  [/^loaf$|^loaves$/, "loaf"],
  [/^bunche?s?$/, "bunch"],
  [/^heads?$/, "head"],
  [/^cartons?$/, "carton"],
  [/^rolls?$/, "roll"],
];

/** Words people say around a list that aren't items. */
const FILLER_START = /^(?:(?:okay|ok|um|uh|so|please|and|also|then|plus)\s+)*(?:(?:can you |could you |please )?(?:add|put|get|buy|grab|pick up|we need|i need|we're out of|we are out of|we're low on|need|we also need|also need|don't forget|remember)\s+)?(?:some\s+|more\s+)?/i;
const FILLER_END = /\s*(?:to|on|onto)\s+(?:the|my|our)\s+(?:grocery\s+|shopping\s+)?list\.?$|\s+please\.?$|\s+(?:too|as well)\.?$/i;

/** "two pounds of apples" → "2 lb apples"; "a dozen eggs" → "1 dozen eggs"; "milk" stays "milk". */
export function tidyItem(raw: string) {
  let s = raw.trim().replace(FILLER_START, "").replace(FILLER_END, "").trim();
  s = s.replace(/[.!?]+$/, "").trim();
  if (!s) return "";
  const words = s.split(/\s+/);
  let qty: number | null = null;
  let i = 0;
  const first = words[0]!.toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(first)) {
    qty = Number(first);
    i = 1;
  } else if (first in NUMBERS && words.length > 1) {
    qty = NUMBERS[first]!;
    i = 1;
    // "half a pound"
    if (first === "half" && /^(a|an)$/i.test(words[1] ?? "")) i = 2;
    // "a couple of", "a half"
    if ((first === "a" || first === "an") && words[1] && /^(couple|half|dozen)$/i.test(words[1])) {
      qty = words[1].toLowerCase() === "couple" ? 2 : words[1].toLowerCase() === "half" ? 0.5 : 1;
      i = words[1].toLowerCase() === "dozen" ? 1 : 2;
    }
  }
  let unit: string | null = null;
  if (qty !== null && words[i]) {
    const u = UNITS.find(([re]) => re.test(words[i]!.toLowerCase()));
    if (u) {
      unit = u[1];
      i++;
    }
  }
  if (qty !== null && words[i]?.toLowerCase() === "of") i++;
  const rest = words.slice(i).join(" ");
  if (!rest) return s;
  // "a banana" → "banana" (one of something needs no number); "a dozen eggs" keeps the dozen.
  if (qty === 1 && !unit && (first === "a" || first === "an")) return rest;
  return [qty !== null ? String(qty) : null, unit, rest].filter(Boolean).join(" ");
}

/**
 * Split a spoken phrase into items. Commas, "and", "also", "then" and "plus"
 * separate items, except inside things like "mac and cheese".
 */
export function splitSpokenItems(text: string, opts: { split?: boolean } = {}): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (opts.split === false) {
    const one = tidyItem(clean);
    return one ? [one] : [];
  }
  // Protect phrases that contain "and".
  let s = clean;
  const saved: string[] = [];
  for (const p of KEEP_TOGETHER) {
    s = s.replace(new RegExp(`\\b${p.replace(/ /g, "\\s+")}\\b`, "gi"), (m) => {
      saved.push(m);
      return `\u0000${saved.length - 1}\u0000`;
    });
  }
  const parts = s
    .split(/\s*[,;\n]\s*|\s+(?:and then|and also|and|also|then|plus|next)\s+/i)
    .map((p) => p.replace(/\u0000(\d+)\u0000/g, (_, n) => saved[Number(n)]!))
    .map(tidyItem)
    .filter((p) => p && !/^(and|also|then|plus|that's it|that is all|done)$/i.test(p));
  // Same thing twice in one breath → once.
  const seen = new Set<string>();
  return parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
