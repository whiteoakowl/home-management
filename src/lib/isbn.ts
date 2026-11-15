/**
 * ISBN helpers and book-metadata parsers. Pure (no I/O) so they are unit-tested;
 * the network lookups live in src/app/actions/library.ts.
 */

export type BookLookup = {
  isbn: string;
  title?: string;
  subtitle?: string;
  author?: string;
  coAuthor?: string;
  publisher?: string;
  publishedDate?: string;
  description?: string;
  genre?: string;
  pageCount?: number;
  coverUrl?: string;
};

const digits = (s: string) => s.replace(/[^0-9Xx]/g, "").toUpperCase();

export function isValidIsbn10(s: string) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  const sum = [...s].reduce((acc, ch, i) => acc + (ch === "X" ? 10 : Number(ch)) * (10 - i), 0);
  return sum % 11 === 0;
}

export function isValidIsbn13(s: string) {
  if (!/^\d{13}$/.test(s)) return false;
  const sum = [...s].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

export function isbn10to13(s: string) {
  const core = `978${s.slice(0, 9)}`;
  const sum = [...core].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 ? 3 : 1), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/**
 * Normalise a scanned or typed ISBN to ISBN-13. Accepts ISBN-10, ISBN-13 and
 * book barcodes (EAN-13 starting 978/979, optionally with a 5-digit add-on).
 */
export function normalizeIsbn(raw: string): string | null {
  let s = digits(String(raw ?? ""));
  if (s.length === 18 && /^97[89]/.test(s)) s = s.slice(0, 13); // EAN + price add-on
  if (s.length === 10 && isValidIsbn10(s)) return isbn10to13(s);
  if (s.length === 13 && /^97[89]/.test(s) && isValidIsbn13(s)) return s;
  return null;
}

const clean = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : undefined);
const https = (u: string | undefined) => (u ? u.replace(/^http:\/\//, "https://") : undefined);

type OLData = {
  title?: string;
  subtitle?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: { name?: string }[];
  cover?: { small?: string; medium?: string; large?: string };
  notes?: string | { value?: string };
  excerpts?: { text?: string }[];
};

/** Open Library `api/books?bibkeys=ISBN:…&jscmd=data` response. */
export function parseOpenLibrary(json: unknown, isbn: string): BookLookup | null {
  const d = (json as Record<string, OLData> | null)?.[`ISBN:${isbn}`];
  if (!d?.title) return null;
  const notes = typeof d.notes === "string" ? d.notes : d.notes?.value;
  return {
    isbn,
    title: clean(d.title),
    subtitle: clean(d.subtitle),
    author: clean(d.authors?.[0]?.name),
    coAuthor: clean(d.authors?.slice(1).map((a) => a.name).filter(Boolean).join(", ")),
    publisher: clean(d.publishers?.[0]?.name),
    publishedDate: clean(d.publish_date),
    description: clean(notes) ?? clean(d.excerpts?.[0]?.text),
    genre: clean(d.subjects?.[0]?.name),
    pageCount: typeof d.number_of_pages === "number" && d.number_of_pages > 0 ? d.number_of_pages : undefined,
    coverUrl: https(d.cover?.large ?? d.cover?.medium ?? d.cover?.small),
  };
}

type GBVolume = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string; small?: string; medium?: string };
  };
};

/** Google Books `volumes?q=isbn:…` response. */
export function parseGoogleBooks(json: unknown, isbn: string): BookLookup | null {
  const v = (json as { items?: GBVolume[] } | null)?.items?.[0]?.volumeInfo;
  if (!v?.title) return null;
  const img = v.imageLinks?.medium ?? v.imageLinks?.small ?? v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
  return {
    isbn,
    title: clean(v.title),
    subtitle: clean(v.subtitle),
    author: clean(v.authors?.[0]),
    coAuthor: clean(v.authors?.slice(1).join(", ")),
    publisher: clean(v.publisher),
    publishedDate: clean(v.publishedDate),
    description: clean(v.description?.replace(/<[^>]+>/g, "")),
    genre: clean(v.categories?.[0]),
    pageCount: typeof v.pageCount === "number" && v.pageCount > 0 ? v.pageCount : undefined,
    coverUrl: https(img?.replace(/&edge=curl/, "")),
  };
}

/** Combine sources: first non-empty value wins, in the order given. */
export function mergeLookups(isbn: string, ...sources: (BookLookup | null)[]): BookLookup | null {
  const found = sources.filter((s): s is BookLookup => !!s);
  if (!found.length) return null;
  const out: BookLookup = { isbn };
  for (const s of found) {
    for (const [k, v] of Object.entries(s) as [keyof BookLookup, BookLookup[keyof BookLookup]][]) {
      if (v !== undefined && v !== "" && out[k] === undefined) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/** "2014-03-18" | "March 2014" | "2014" → the year, for display & stats. */
export function publishedYear(d: string | null | undefined) {
  return d?.match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1] ?? null;
}
