/**
 * Grocery receipt text → items. Pure module (unit-tested in tests/receipt.test.ts).
 * Works on OCR output, so it is forgiving: anything it gets wrong is fixed by the
 * person on the review screen. Nothing is ever added to the pantry without review.
 */
import { guessShoppingCategory, locationForCategory, type ShoppingCategoryKey, type StorageLoc } from "./shopping-category";

export type ReceiptItem = { name: string; quantity: number; unit: string | null; priceCents: number | null; category: ShoppingCategoryKey; location: StorageLoc };
export type ParsedReceipt = { store: string | null; date: string | null; totalCents: number | null; items: ReceiptItem[] };

const KNOWN_STORES = ["Walmart", "Kroger", "Aldi", "Costco", "Target", "Publix", "Ingles", "Lowes Foods", "Food Lion", "Whole Foods", "Trader Joe's", "Safeway", "H-E-B", "Sprouts", "Harris Teeter", "Wegmans", "Meijer", "Sam's Club", "Fresh Market", "Albertsons", "Giant", "Hy-Vee", "Winn-Dixie", "Piggly Wiggly", "Dollar General", "CVS", "Walgreens"];

/** Lines that are payment / summary lines, never groceries. */
const NOT_ITEM = /\b(sub-?total|total|tax|change|cash|visa|master ?card|amex|discover|debit|credit|balance|tender|payment|auth|approv|ref ?#|account|card ?#|you saved|savings|loyalty|points|reward|coupon|discount|member|thank|receipt|store ?#|cashier|register|trans(action)?|terminal|items? sold|qty sold|eft|chip|contactless|pin|merchant|invoice|order ?#|tel|phone|www\.|\.com)\b/i;
const PRICE_AT_END = /(-?\$?\d{1,4}[.,]\d{2})\s*(?:[A-Z]{1,2}|\*)?\s*$/;
const DATE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/;

const cents = (s: string) => Math.round(Number(s.replace("$", "").replace(",", ".")) * 100);

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Lb|Oz|Ct|Pk|Gal|Qt)\b/g, (m) => m.toLowerCase());
}

/** Tidy an OCR'd product name: drop item codes, flags and stray symbols. */
export function cleanItemName(raw: string) {
  return titleCase(
    raw
      .replace(/^\s*\d{4,}\s+/, "") // leading item/PLU code
      .replace(/\s+\d{6,}\s*/g, " ") // embedded UPC
      .replace(/[*#@~_=|<>{}[\]]/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s.\-:]+|[\s.\-:]+$/g, "")
      .trim(),
  ).slice(0, 80);
}

export function parseReceiptDate(text: string): string | null {
  const m = DATE.exec(text);
  if (!m) return null;
  if (m[4]) return `${m[4]}-${m[5]}-${m[6]}`;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const known = KNOWN_STORES.find((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\']/g, ".?")}\\b`, "i").test(lines.slice(0, 8).join(" ")));
  const firstName = lines.slice(0, 4).find((l) => /[a-z]{3,}/i.test(l) && !/\d{3}[-. ]\d{3,4}|street|st\.|ave|road|rd\.|blvd|suite/i.test(l) && !PRICE_AT_END.test(l));
  const store = known ?? (firstName ? titleCase(firstName).slice(0, 60) : null);

  let date: string | null = null;
  for (const l of lines) if (!date) date = parseReceiptDate(l);

  let totalCents: number | null = null;
  for (const l of lines) {
    if (/\b(sub-?total|total savings|total tax|items)\b/i.test(l)) continue;
    const m = /\b(total|balance due|amount due|grand total)\b.*?(\d{1,5}[.,]\d{2})/i.exec(l);
    if (m) totalCents = cents(m[2]!);
  }

  const items: ReceiptItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // "2 @ 1.99" / "1.32 lb @ 2.99 /lb" detail lines set quantity on the item above.
    const at = /^(\d+(?:\.\d+)?)\s*(lb|lbs|kg|oz|ea)?\s*(?:@|x)\s*\$?(\d+[.,]\d{2})/i.exec(line);
    if (at) {
      const above = lines[i - 1];
      // A weighed item usually has its name alone on the line above ("CHICKEN BREAST").
      if (above && !PRICE_AT_END.test(above) && /[a-z]{2,}/i.test(above) && !NOT_ITEM.test(above)) {
        const name = cleanItemName(above);
        const category = guessShoppingCategory(name);
        items.push({ name, quantity: 1, unit: null, priceCents: null, category, location: locationForCategory(category) });
      }
      if (!items.length) continue;
      const prev = items[items.length - 1]!;
      prev.quantity = Number(at[1]);
      prev.unit = at[2] ? at[2].toLowerCase().replace("lbs", "lb").replace("ea", "") || null : null;
      const total = PRICE_AT_END.exec(line);
      if (total && prev.priceCents === null) prev.priceCents = cents(total[1]!);
      continue;
    }
    const price = PRICE_AT_END.exec(line);
    if (!price) continue;
    if (NOT_ITEM.test(line)) continue;
    let name = line.slice(0, price.index).trim();
    if (!/[a-z]{2,}/i.test(name)) {
      // Price on its own line: the name is the line above (if it isn't already an item).
      const above = lines[i - 1];
      if (!above || PRICE_AT_END.test(above) || NOT_ITEM.test(above)) continue;
      name = above;
    }
    const value = cents(price[1]!);
    if (value <= 0) continue; // discounts/voids
    let quantity = 1;
    const lead = /^(\d{1,2})\s+(?:x\s+)?([a-z].*)$/i.exec(name);
    if (lead && Number(lead[1]) > 0 && Number(lead[1]) < 50) {
      quantity = Number(lead[1]);
      name = lead[2]!;
    }
    const clean = cleanItemName(name);
    if (clean.length < 2) continue;
    const category = guessShoppingCategory(clean);
    items.push({ name: clean, quantity, unit: null, priceCents: value, category, location: locationForCategory(category) });
  }
  return { store, date, totalCents, items };
}

/** Same product? (case/spacing/plural-insensitive) — used to offer "add to existing" instead of a duplicate. */
export function sameProduct(a: string, b: string) {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\b(the|a|an|fresh|organic|large|small|medium|lb|oz|ct|pk|gal)\b/g, " ")
      .replace(/s\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const x = n(a);
  const y = n(b);
  return !!x && !!y && (x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x))));
}
