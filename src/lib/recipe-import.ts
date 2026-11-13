/**
 * Recipe import: schema.org/Recipe JSON-LD (used by most recipe sites) and a
 * plain-text fallback for pasted recipes. Pure module (unit-tested).
 */
export type ImportedRecipe = {
  name: string;
  description: string | null;
  ingredients: string[];
  instructions: string[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  imageUrl: string | null;
  tags: string[];
  source: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };

export function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+\d*);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const clean = (s: unknown) =>
  typeof s === "string"
    ? decodeEntities(s.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim()
    : "";

/** ISO-8601 duration (PT1H30M, P0DT0H20M) → minutes. */
export function durationMinutes(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?$/i.exec(iso.trim());
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return total > 0 ? Math.round(total) : null;
}

function servingsOf(y: unknown): number | null {
  const v = Array.isArray(y) ? y.find((x) => /\d/.test(String(x))) ?? y[0] : y;
  const n = /(\d+)/.exec(String(v ?? ""));
  return n ? Math.min(100, Number(n[1])) : null;
}

function instructionsOf(x: unknown): string[] {
  if (!x) return [];
  if (typeof x === "string") return x.split(/\n+|(?<=\.)\s+(?=[A-Z])/).map(clean).filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(instructionsOf);
  if (typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (o.itemListElement) return instructionsOf(o.itemListElement); // HowToSection
    return [clean(o.text ?? o.name)].filter(Boolean);
  }
  return [];
}

function imageOf(x: unknown): string | null {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return imageOf(x[0]);
  const o = x as Record<string, unknown>;
  return typeof o.url === "string" ? o.url : typeof o["@id"] === "string" ? (o["@id"] as string) : null;
}

const isRecipe = (o: Record<string, unknown>) => {
  const t = o["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
};

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  if (isRecipe(o)) return o;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
    const r = findRecipe(o[k]);
    if (r) return r;
  }
  return null;
}

/** Find and normalise a schema.org Recipe in an HTML page. */
export function parseRecipeHtml(html: string, url?: string): ImportedRecipe | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!);
  for (const raw of blocks) {
    let json: unknown;
    try {
      json = JSON.parse(raw.trim());
    } catch {
      try {
        json = JSON.parse(raw.trim().replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        continue;
      }
    }
    const r = findRecipe(json);
    if (!r) continue;
    const name = clean(r.name);
    if (!name) continue;
    const ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : []).map(clean).filter(Boolean);
    const tags = [
      ...(Array.isArray(r.recipeCategory) ? r.recipeCategory : r.recipeCategory ? [r.recipeCategory] : []),
      ...(Array.isArray(r.recipeCuisine) ? r.recipeCuisine : r.recipeCuisine ? [r.recipeCuisine] : []),
      ...(typeof r.keywords === "string" ? r.keywords.split(",") : Array.isArray(r.keywords) ? r.keywords : []),
    ]
      .map((t) => clean(t).toLowerCase())
      .filter((t) => t && t.length <= 30);
    const prep = durationMinutes(r.prepTime);
    const cook = durationMinutes(r.cookTime) ?? (prep === null ? durationMinutes(r.totalTime) : null);
    let image = imageOf(r.image);
    if (image && url && !/^https?:/i.test(image)) {
      try {
        image = new URL(image, url).toString();
      } catch {
        image = null;
      }
    }
    return {
      name: name.slice(0, 200),
      description: clean(r.description).slice(0, 2000) || null,
      ingredients: ingredients.slice(0, 100),
      instructions: instructionsOf(r.recipeInstructions).slice(0, 100),
      servings: servingsOf(r.recipeYield),
      prepMinutes: prep,
      cookMinutes: cook,
      imageUrl: image,
      tags: [...new Set(tags)].slice(0, 10),
      source: url ?? null,
    };
  }
  return null;
}

const HEAD_ING = /^(ingredients?|you('| wi)ll need|what you need)\s*:?$/i;
const HEAD_STEP = /^(instructions?|directions?|method|preparation|steps?)\s*:?$/i;
const looksLikeIngredient = (l: string) => /^([-*•]\s*)?(\d|½|¼|¾|⅓|⅔|a |an |one |two |three |pinch|dash|handful)/i.test(l) && l.length < 120;

/** Best-effort parse of a pasted recipe (title, ingredients, steps). */
export function parseRecipeText(text: string): ImportedRecipe | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length < 2) return null;
  const name = nonEmpty[0]!.replace(/^#+\s*/, "").slice(0, 200);
  let mode: "intro" | "ing" | "step" = "intro";
  const ingredients: string[] = [];
  const steps: string[] = [];
  const intro: string[] = [];
  let servings: number | null = null;
  for (const l of lines.slice(lines.indexOf(nonEmpty[0]!) + 1)) {
    if (!l) continue;
    const sv = /^(serves|servings|yield|makes)\s*:?\s*(\d+)/i.exec(l);
    if (sv) {
      servings = Number(sv[2]);
      continue;
    }
    if (HEAD_ING.test(l)) {
      mode = "ing";
      continue;
    }
    if (HEAD_STEP.test(l)) {
      mode = "step";
      continue;
    }
    if (mode === "intro" && looksLikeIngredient(l)) mode = "ing";
    if (mode === "ing" && !looksLikeIngredient(l) && l.length > 60) mode = "step";
    const item = l.replace(/^([-*•]|\d+[.)])\s+/, "");
    if (mode === "ing") ingredients.push(item);
    else if (mode === "step") steps.push(item);
    else intro.push(l);
  }
  if (!ingredients.length && !steps.length) return null;
  return { name, description: intro.join(" ").slice(0, 2000) || null, ingredients, instructions: steps, servings, prepMinutes: null, cookMinutes: null, imageUrl: null, tags: [], source: null };
}

/** Timers in a step: "bake 25 minutes", "simmer for 1 hour", "10-12 min". Returns seconds (upper bound of ranges). */
export function timersIn(step: string): { label: string; seconds: number }[] {
  const out: { label: string; seconds: number }[] = [];
  const re = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?)/gi;
  for (const m of step.matchAll(re)) {
    const n = Number(m[2] ?? m[1]);
    const unit = m[3]!.toLowerCase();
    const seconds = Math.round(unit.startsWith("h") ? n * 3600 : unit.startsWith("s") ? n : n * 60);
    if (seconds > 0 && seconds <= 24 * 3600) out.push({ label: m[0], seconds });
  }
  return out;
}
