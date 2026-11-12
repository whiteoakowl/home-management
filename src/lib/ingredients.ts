/**
 * Ingredient parsing & inventory matching (pure, unit-tested).
 * "1 1/2 cups all-purpose flour, sifted" → { quantity: 1.5, unit: "cup", name: "all-purpose flour" }
 */

const UNICODE_FRACTIONS: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅕": 0.2 };

const UNITS: Record<string, string> = {
  cup: "cup", cups: "cup", c: "cup",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbs: "tbsp", T: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp", t: "tsp",
  pound: "lb", pounds: "lb", lb: "lb", lbs: "lb",
  ounce: "oz", ounces: "oz", oz: "oz",
  gram: "g", grams: "g", g: "g", kilogram: "kg", kilograms: "kg", kg: "kg",
  milliliter: "ml", milliliters: "ml", ml: "ml", liter: "l", liters: "l", l: "l",
  quart: "qt", quarts: "qt", qt: "qt", pint: "pt", pints: "pt", pt: "pt", gallon: "gal", gallons: "gal", gal: "gal",
  clove: "clove", cloves: "clove", can: "can", cans: "can", package: "pkg", packages: "pkg", pkg: "pkg",
  slice: "slice", slices: "slice", stick: "stick", sticks: "stick", bunch: "bunch", bunches: "bunch",
  pinch: "pinch", dash: "dash", head: "head", heads: "head", dozen: "dozen", jar: "jar", jars: "jar",
  bag: "bag", bags: "bag", box: "box", boxes: "box", loaf: "loaf", loaves: "loaf", sprig: "sprig", sprigs: "sprig",
};

function parseNumber(token: string): number | null {
  if (UNICODE_FRACTIONS[token] !== undefined) return UNICODE_FRACTIONS[token]!;
  const mixed = token.match(/^(\d+)([½⅓⅔¼¾⅛⅕])$/);
  if (mixed) return Number(mixed[1]) + UNICODE_FRACTIONS[mixed[2]!]!;
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const range = token.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (range) return Number(range[2]); // "2-3 cloves" → plan for 3
  const n = Number(token);
  return Number.isFinite(n) && token !== "" ? n : null;
}

export type ParsedIngredient = { original: string; quantity: number | null; unit: string | null; name: string; optional: boolean };

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const original = line.trim().replace(/^[-*•]\s*/, "");
  if (!original) return null;
  const optional = /\(optional\)|\boptional\b/i.test(original);
  const tokens = original.replace(/\s+/g, " ").split(" ");
  let quantity: number | null = null;
  let i = 0;
  // Up to two numeric tokens ("1 1/2")
  for (let k = 0; k < 2 && i < tokens.length; k++) {
    const n = parseNumber(tokens[i]!);
    if (n === null) break;
    quantity = (quantity ?? 0) + n;
    i++;
  }
  let unit: string | null = null;
  if (i < tokens.length) {
    const raw = tokens[i]!.replace(/\.$/, "");
    const key = UNITS[raw] ? raw : UNITS[raw.toLowerCase()] && raw.length > 1 ? raw.toLowerCase() : null;
    if (key && (quantity !== null || raw.length > 2)) {
      unit = UNITS[key]!;
      i++;
      if (tokens[i]?.toLowerCase() === "of") i++;
    }
  }
  let name = tokens.slice(i).join(" ");
  name = name
    .replace(/\(.*?\)/g, "")
    .split(",")[0]!
    .replace(/\b(fresh|large|small|medium|chopped|diced|minced|sliced|optional|to taste|divided|softened|melted|packed|finely|roughly|about)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) name = original;
  return { original, quantity, unit, name: name.toLowerCase(), optional };
}

/** Normalised key for matching: lowercase, singular, no punctuation. */
export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.endsWith("oes") ? w.slice(0, -2) : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
}

/** Does an inventory item satisfy an ingredient? Word-subset match either way. */
export function namesMatch(ingredient: string, item: string) {
  const a = normalizeName(ingredient);
  const b = normalizeName(item);
  if (!a || !b) return false;
  if (a === b) return true;
  const aw = a.split(" ");
  const bw = b.split(" ");
  // "chicken breast" ↔ "chicken" ; "eggs" ↔ "large eggs" ; avoid "pepper" ↔ "bell pepper"? accepted
  const contains = (x: string[], y: string[]) => y.every((w) => x.includes(w));
  return contains(aw, bw) || contains(bw, aw);
}

export type InventoryLike = { id: string; name: string; quantity: string | number; unit: string | null };

export type IngredientStatus = {
  name: string;
  original: string | null;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
  have: boolean;
  matchedItem: string | null;
  shortBy: number | null;
};

/** Compare recipe ingredients against inventory. */
export function checkIngredients(
  ingredients: { name: string; original?: string | null; quantity: string | number | null; unit: string | null; optional?: boolean }[],
  inventory: InventoryLike[],
  scale = 1,
): IngredientStatus[] {
  return ingredients.map((ing) => {
    const need = ing.quantity !== null && ing.quantity !== "" ? Number(ing.quantity) * scale : null;
    const matches = inventory.filter((it) => namesMatch(ing.name, it.name));
    const sameUnit = matches.filter((m) => (m.unit ?? "") === (ing.unit ?? ""));
    const haveQty = sameUnit.reduce((s, m) => s + Number(m.quantity), 0);
    let have = matches.length > 0 && matches.some((m) => Number(m.quantity) > 0);
    let shortBy: number | null = null;
    if (have && need !== null && sameUnit.length > 0 && haveQty < need) {
      have = false;
      shortBy = Math.round((need - haveQty) * 100) / 100;
    }
    return {
      name: ing.name,
      original: ing.original ?? null,
      quantity: need,
      unit: ing.unit,
      optional: !!ing.optional,
      have,
      matchedItem: matches[0]?.name ?? null,
      shortBy,
    };
  });
}

export function formatQty(q: number | null) {
  if (q === null) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  const map: [number, string][] = [[0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
  const hit = map.find(([v]) => Math.abs(v - frac) < 0.02);
  if (frac < 0.02) return String(whole);
  if (hit) return `${whole ? whole : ""}${hit[1]}`;
  return String(Math.round(q * 100) / 100);
}
