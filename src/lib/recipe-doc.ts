/**
 * Word (.docx) recipe import: one recipe per page. Pure module (tests/recipe-doc.test.ts).
 *
 * A .docx is a ZIP; the text lives in word/document.xml. Pages are split at explicit
 * page breaks, "page break before" paragraphs and section breaks. If the document has
 * none, Word's own rendered page breaks are used. Each page is read as one recipe; fields
 * that aren't clearly there are left blank (never invented).
 */
import { inflateRawSync } from "node:zlib";
import { decodeEntities } from "./recipe-import";

/** Read one file out of a ZIP buffer (stored or deflated entries). */
export function unzipEntry(buf: Buffer, name: string): Buffer | null {
  // End of central directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const entryName = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (entryName === name) {
      const lNameLen = buf.readUInt16LE(local + 26);
      const lExtraLen = buf.readUInt16LE(local + 28);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + size);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

type Para = { text: string; heading: boolean; list: boolean };

/** Split document.xml into pages of paragraphs. */
export function docxPages(xml: string): Para[][] {
  const body = xml.replace(/^[\s\S]*?<w:body>/, "").replace(/<\/w:body>[\s\S]*$/, "");
  const explicit = /<w:br\b[^>]*w:type="page"|<w:pageBreakBefore\b(?![^>]*w:val="(?:0|false)")|<w:pPr>(?:(?!<\/w:pPr>)[\s\S])*<w:sectPr\b/.test(body);
  const pages: Para[][] = [[]];
  const newPage = () => {
    if (pages[pages.length - 1]!.length) pages.push([]);
  };
  for (const m of body.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g)) {
    const inner = m[1] ?? "";
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(inner)?.[1] ?? "";
    if (/<w:pageBreakBefore\b(?![^>]*w:val="(?:0|false)")/.test(pPr)) newPage();
    const style = /<w:pStyle w:val="([^"]+)"/.exec(pPr)?.[1] ?? "";
    const heading = /^(Title|Heading1|Heading2|heading 1|Subtitle)$/i.test(style) || /^Heading[12]$/i.test(style);
    const list = /<w:numPr>/.test(pPr) || /List/i.test(style);
    // Walk runs in order so a page break in the middle of a paragraph splits it.
    let text = "";
    const flush = () => {
      const t = decodeEntities(text).replace(/[ \t ]+/g, " ").trim();
      if (t) pages[pages.length - 1]!.push({ text: t, heading, list });
      text = "";
    };
    for (const r of inner.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\b([^>]*)\/>|<w:lastRenderedPageBreak\/>/g)) {
      if (r[1] !== undefined) text += r[1];
      else if (r[0] === "<w:tab/>") text += "\t";
      else if (r[0].startsWith("<w:br")) {
        if (/w:type="page"/.test(r[2] ?? "")) {
          flush();
          newPage();
        } else text += "\n";
      } else if (!explicit) {
        // Word's own page layout, used only when the author didn't add page breaks.
        flush();
        newPage();
      }
    }
    // Lines inside one paragraph (soft breaks) become separate lines.
    const before = pages[pages.length - 1]!.length;
    const parts = text.split("\n");
    for (const part of parts) {
      text = part;
      flush();
    }
    if (pages[pages.length - 1]!.length === before && !parts.length) flush();
    if (/<w:sectPr\b/.test(pPr)) newPage();
  }
  return pages.filter((p) => p.some((x) => x.text));
}

export type DocRecipe = {
  name: string;
  ingredients: string[];
  instructions: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  servings: number | null;
  notes: string | null;
  source: string | null;
  category: string | null;
  description: string | null;
};

/** "1 hr 20 min", "1 1/2 hours", "45 minutes", "1h30m", "90 min" → minutes. */
export function parseDuration(s: string): number | null {
  const t = s.toLowerCase().replace(/½/g, ".5").replace(/(\d+)\s+1\/2/g, "$1.5");
  let mins = 0;
  let found = false;
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(h(?:ou)?rs?|hrs?|h(?![a-z])|m(?:in(?:ute)?s?)?(?![a-z]))/g)) {
    found = true;
    mins += m[2]!.startsWith("h") ? Number(m[1]) * 60 : Number(m[1]);
  }
  if (!found) {
    const n = /^\s*(\d+)\s*$/.exec(t);
    return n ? Number(n[1]) : null;
  }
  return mins > 0 ? Math.round(mins) : null;
}

const HEAD_ING = /^(ingredients?|you(?:'|’)ll need|what you need)\s*:?\s*$/i;
const HEAD_STEP = /^(directions?|instructions?|method|steps?|preparation|how to make( it)?)\s*:?\s*$/i;
const HEAD_NOTES = /^(notes?|tips?|cook'?s notes?)\s*:?\s*(.*)$/i;
const FIELD = /^(prep(?:aration)?(?: time)?|cook(?:ing)?(?: time)?|bake(?: time)?|total(?: time)?|serves|servings|yield|makes|source|from|recipe from|category|course)\s*:?\s*(.+)$/i;
const QTY = /^([-*•–]\s*)?(\d|½|¼|¾|⅓|⅔|⅛|a |an |one |two |three |pinch|dash|handful)/i;
const UNIT = /\b(cups?|c\.|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|cloves?|cans?|packages?|pkg|sticks?|slices?|pinch|dash|large|medium|small|whole)\b/i;

const looksLikeIngredient = (l: string) => (QTY.test(l) && (UNIT.test(l) || l.length < 60)) || (/^[-*•–]\s/.test(l) && l.length < 80);

/** Read one page of text as a recipe. Returns null when the page doesn't look like a recipe. */
export function parseRecipePage(paras: Para[]): DocRecipe | null {
  const lines = paras.map((p) => p.text);
  if (!lines.length) return null;
  const titleIdx = Math.max(0, paras.findIndex((p) => p.heading));
  const name = lines[titleIdx]!.replace(/^recipe\s*:\s*/i, "").slice(0, 200);
  const r: DocRecipe = { name, ingredients: [], instructions: [], prepMinutes: null, cookMinutes: null, totalMinutes: null, servings: null, notes: null, source: null, category: null, description: null };
  let mode: "intro" | "ing" | "step" | "notes" = "intro";
  const intro: string[] = [];
  const notes: string[] = [];
  paras.forEach((p, i) => {
    if (i === titleIdx) return;
    const l = p.text;
    const field = FIELD.exec(l);
    if (field && mode !== "step" && l.length < 90) {
      const k = field[1]!.toLowerCase();
      const v = field[2]!.trim();
      if (k.startsWith("prep")) r.prepMinutes = parseDuration(v);
      else if (k.startsWith("cook") || k.startsWith("bake")) r.cookMinutes = parseDuration(v);
      else if (k.startsWith("total")) r.totalMinutes = parseDuration(v);
      else if (/serves|servings|yield|makes/.test(k)) r.servings = Number(/\d+/.exec(v)?.[0]) || null;
      else if (/source|from/.test(k)) r.source = v.slice(0, 200);
      else if (/category|course/.test(k)) r.category = v.slice(0, 60);
      return;
    }
    if (HEAD_ING.test(l)) return void (mode = "ing");
    if (HEAD_STEP.test(l)) return void (mode = "step");
    const nh = HEAD_NOTES.exec(l);
    if (nh && l.length < 40 + (nh[2]?.length ?? 0)) {
      mode = "notes";
      if (nh[2]) notes.push(nh[2]);
      return;
    }
    if (mode === "intro" && (p.list || looksLikeIngredient(l))) mode = "ing";
    if (mode === "ing" && !p.list && !looksLikeIngredient(l) && l.length > 60) mode = "step";
    const item = l.replace(/^([-*•–]|\d+[.)]|step \d+:?)\s*/i, "");
    if (mode === "ing") r.ingredients.push(item);
    else if (mode === "step") r.instructions.push(item);
    else if (mode === "notes") notes.push(l);
    else intro.push(l);
  });
  if (!r.ingredients.length && !r.instructions.length) return null;
  r.description = intro.join(" ").slice(0, 2000) || null;
  r.notes = notes.join("\n").slice(0, 4000) || null;
  return r;
}

/** All recipes in a .docx, one per page. */
export function recipesFromDocx(buf: Buffer): { recipes: DocRecipe[]; pages: number } {
  const xml = unzipEntry(buf, "word/document.xml");
  if (!xml) throw new Error("That doesn't look like a Word (.docx) document.");
  const pages = docxPages(xml.toString("utf8"));
  return { recipes: pages.map(parseRecipePage).filter((x): x is DocRecipe => !!x), pages: pages.length };
}
