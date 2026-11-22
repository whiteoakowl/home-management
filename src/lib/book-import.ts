/**
 * Book import: read a spreadsheet (CSV) from Goodreads, StoryGraph, LibraryThing or
 * the family's own sheet, or a pasted list of ISBNs. Pure (unit-tested in
 * tests/book-import.test.ts); saving happens in app/actions/library.ts.
 */
import { normalizeIsbn } from "./isbn";

/** RFC 4180-style CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ImportedBook = {
  title: string;
  author: string | null;
  isbn: string | null;
  pageCount: number | null;
  publisher: string | null;
  publishedDate: string | null;
  format: string | null;
  rating: number | null;
  /** Reading shelf from the source, mapped to our reading-log status (only used if the person asks). */
  readingStatus: "reading" | "completed" | "want_to_read" | null;
  finishedOn: string | null;
  /** From an online ISBN lookup. */
  subtitle?: string | null;
  description?: string | null;
  coverUrl?: string | null;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header names we recognise for each field (Goodreads, StoryGraph, LibraryThing and plain sheets). */
const HEADERS: Record<keyof Omit<ImportedBook, "readingStatus" | "finishedOn" | "subtitle" | "description" | "coverUrl"> | "isbn10" | "shelf" | "dateRead", string[]> = {
  title: ["title", "booktitle", "name"],
  author: ["author", "authors", "primaryauthor", "authorlf", "writer"],
  isbn: ["isbn13", "isbn", "isbnuid", "ean", "barcode"],
  isbn10: ["isbn10"],
  pageCount: ["numberofpages", "pages", "pagecount", "numpages"],
  publisher: ["publisher"],
  publishedDate: ["yearpublished", "originalpublicationyear", "publicationyear", "published", "date", "year"],
  format: ["binding", "format", "media"],
  rating: ["myrating", "starrating", "rating"],
  shelf: ["exclusiveshelf", "readstatus", "status", "collections"],
  dateRead: ["dateread", "lastdateread", "datefinished", "finished"],
};

/** Goodreads wraps ISBNs as ="0439023483" so spreadsheets keep the leading zero. */
const cleanIsbn = (v: string | undefined) => (v ? normalizeIsbn(v.replace(/^="?|"$/g, "").trim()) : null);

const FORMAT: [RegExp, string][] = [
  [/hard/i, "hardcover"],
  [/paper|mass market|trade/i, "paperback"],
  [/kindle|ebook|e-book|digital|nook/i, "ebook"],
  [/audio/i, "audiobook"],
];

const SHELF: [RegExp, ImportedBook["readingStatus"]][] = [
  [/currently|reading|in progress/i, "reading"],
  [/^read$|finished|completed/i, "completed"],
  [/to-read|to read|want|wishlist/i, "want_to_read"],
];

function isoDate(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/) ?? t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [y, mo, d] = m[1]!.length === 4 ? [m[1]!, m[2]!, m[3]!] : [m[3]!, m[1]!, m[2]!];
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Turn a CSV into books. The first row must be headers; at least a Title column is
 * needed. Returns the books plus how many rows were skipped (no title).
 */
export function booksFromCsv(text: string, max = 1000): { books: ImportedBook[]; skipped: number; error?: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { books: [], skipped: 0, error: "That file doesn't have any books in it. The first row should be column names, like Title and Author." };
  const head = rows[0]!.map(norm);
  const col = (k: keyof typeof HEADERS) => {
    for (const name of HEADERS[k]) {
      const i = head.indexOf(name);
      if (i >= 0) return i;
    }
    return -1;
  };
  const c = Object.fromEntries((Object.keys(HEADERS) as (keyof typeof HEADERS)[]).map((k) => [k, col(k)])) as Record<keyof typeof HEADERS, number>;
  if (c.title < 0) return { books: [], skipped: 0, error: "We couldn't find a Title column. Name the column with the book titles \"Title\"." };
  const get = (r: string[], k: keyof typeof HEADERS) => (c[k] >= 0 ? (r[c[k]] ?? "").trim() : "");
  const books: ImportedBook[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const title = get(r, "title").slice(0, 300);
    if (!title) {
      skipped++;
      continue;
    }
    if (books.length >= max) {
      skipped++;
      continue;
    }
    const pages = parseInt(get(r, "pageCount"), 10);
    const rating = Math.round(parseFloat(get(r, "rating")));
    const fmt = get(r, "format");
    const shelf = get(r, "shelf");
    const year = get(r, "publishedDate");
    books.push({
      title,
      author: get(r, "author").slice(0, 200) || null,
      isbn: cleanIsbn(get(r, "isbn")) ?? cleanIsbn(get(r, "isbn10")),
      pageCount: pages > 0 && pages <= 50000 ? pages : null,
      publisher: get(r, "publisher").slice(0, 200) || null,
      publishedDate: /^\d{4}(-\d{2}(-\d{2})?)?$/.test(year) ? year : null,
      format: FORMAT.find(([re]) => re.test(fmt))?.[1] ?? null,
      rating: rating >= 1 && rating <= 5 ? rating : null,
      readingStatus: SHELF.find(([re]) => re.test(shelf))?.[1] ?? null,
      finishedOn: isoDate(get(r, "dateRead")),
    });
  }
  return { books, skipped };
}

/** ISBNs from pasted text (one per line, or separated by commas/spaces). Invalid ones are counted. */
export function isbnsFromText(text: string, max = 25): { isbns: string[]; invalid: number; extra: number } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const valid: string[] = [];
  let invalid = 0;
  for (const p of parts) {
    const n = normalizeIsbn(p);
    if (!n) invalid++;
    else if (!valid.includes(n)) valid.push(n);
  }
  return { isbns: valid.slice(0, max), invalid, extra: Math.max(0, valid.length - max) };
}

/** Same book? Same ISBN, or the same title and author (ignoring case and punctuation). */
export const bookKey = (b: { title: string; author: string | null; isbn: string | null }) => (b.isbn ? `isbn:${b.isbn}` : `t:${norm(b.title)}|${norm(b.author ?? "")}`);
