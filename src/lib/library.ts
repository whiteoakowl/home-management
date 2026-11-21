import "server-only";
import { cookies } from "next/headers";
import { and, asc, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookCategories, books, categories, familyMembers, readingEntries } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";

export type Book = typeof books.$inferSelect;
export type ReadingEntry = typeof readingEntries.$inferSelect;
export type BookCategory = { id: string; name: string; color: string | null; sortOrder: number };

/**
 * Books the viewer may see: Family Library books by their visibility, plus the viewer's
 * own personal library. Someone's personal library is visible only to them, parents included.
 */
export const bookVisible = (viewer: Viewer) =>
  or(
    and(isNull(books.ownerMemberId), visibleTo(viewer, { id: books.id, visibility: books.visibility, author: books.createdByMemberId }, "book")),
    eq(books.ownerMemberId, viewer.member.id),
  )!;

/** Which library the viewer is looking at: the Family Library or their own (My Library). */
export type LibrarySpace = "family" | "mine";
export const LIBRARY_SPACE_COOKIE = "library-space";
export async function currentLibrarySpace(): Promise<LibrarySpace> {
  return (await cookies()).get(LIBRARY_SPACE_COOKIE)?.value === "mine" ? "mine" : "family";
}

/** Anyone who can open the library may keep a personal one; the Family Library needs "Add & edit". */
export const canAddBooks = (viewer: Viewer, space: LibrarySpace) => (space === "mine" ? viewer.can("library", "view") : viewer.can("library", "edit"));

/** May the viewer change this book? Personal books: only their owner. */
export const canChangeBook = (viewer: Viewer, b: { ownerMemberId: string | null; createdByMemberId: string | null }) =>
  b.ownerMemberId ? b.ownerMemberId === viewer.member.id : viewer.can("library", "edit") && (viewer.isParent || b.createdByMemberId === viewer.member.id);

export async function bookCategoryList(viewer: Viewer): Promise<BookCategory[]> {
  return db
    .select({ id: categories.id, name: categories.name, color: categories.color, sortOrder: categories.sortOrder })
    .from(categories)
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "book")))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

/** Every visible book in the current library (Family or My Library) with its category ids. */
export async function listBooks(viewer: Viewer, space?: LibrarySpace) {
  const s = space ?? (await currentLibrarySpace());
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.familyId, viewer.family.id), bookVisible(viewer), s === "mine" ? eq(books.ownerMemberId, viewer.member.id) : isNull(books.ownerMemberId)))
    .orderBy(asc(books.title));
  const ids = rows.map((b) => b.id);
  const [links, mine] = ids.length
    ? await Promise.all([
        db.select().from(bookCategories).where(inArray(bookCategories.bookId, ids)),
        db.select().from(readingEntries).where(and(eq(readingEntries.memberId, viewer.member.id), inArray(readingEntries.bookId, ids))),
      ])
    : [[], []];
  const byBook = Map.groupBy(links, (l) => l.bookId);
  const myEntry = new Map(mine.map((e) => [e.bookId, e]));
  // `reading` is the viewer's own reading-log entry for the book (null if it isn't in their log).
  return rows.map((b) => ({ ...b, categoryIds: (byBook.get(b.id) ?? []).map((l) => l.categoryId), reading: myEntry.get(b.id) ?? null }));
}
export type BookWithCats = Awaited<ReturnType<typeof listBooks>>[number];

export async function getBook(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [b] = await db.select().from(books).where(and(eq(books.id, id), eq(books.familyId, viewer.family.id), bookVisible(viewer)));
  if (!b) return null;
  const links = await db.select().from(bookCategories).where(eq(bookCategories.bookId, b.id));
  return { ...b, categoryIds: links.map((l) => l.categoryId) };
}

/** Reading statistics for the dashboard (from the viewer's own reading log). */
export function libraryStats(list: BookWithCats[], cats: BookCategory[], year: string) {
  const st = (b: BookWithCats) => b.reading?.status;
  const done = list.filter((b) => st(b) === "completed");
  const thisYear = done.filter((b) => b.reading?.finishedOn?.startsWith(year));
  const pagesThisYear = thisYear.reduce((s, b) => s + (b.pageCount ?? 0), 0);
  // "Favourite" = most-read (finished), weighted up by favourites and high ratings.
  const weight = (b: BookWithCats) => (st(b) === "completed" ? 1 : 0) + (b.isFavorite ? 1 : 0) + ((b.rating ?? 0) >= 4 ? 1 : 0);
  const tally = (keys: (b: BookWithCats) => string[]) => {
    const m = new Map<string, number>();
    for (const b of list) for (const k of keys(b)) if (weight(b)) m.set(k, (m.get(k) ?? 0) + weight(b));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const authors = new Map<string, number>();
  for (const b of list) if (b.author) authors.set(b.author, (authors.get(b.author) ?? 0) + 1);
  return {
    total: list.length,
    reading: list.filter((b) => st(b) === "reading"),
    completed: done.length,
    toRead: list.filter((b) => st(b) === "want_to_read"),
    favorites: list.filter((b) => b.isFavorite),
    booksThisYear: thisYear.length,
    pagesThisYear,
    favoriteCategories: tally((b) => b.categoryIds.filter((id) => catName.has(id)).map((id) => catName.get(id)!)).slice(0, 5),
    favoriteAuthors: tally((b) => (b.author ? [b.author] : [])).slice(0, 5),
    authors: [...authors.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    categoryCounts: cats.map((c) => ({ ...c, count: list.filter((b) => b.categoryIds.includes(c.id)).length })),
    uncategorized: list.filter((b) => !b.categoryIds.length).length,
  };
}

// ─── Reading log ─────────────────────────────────────────────────────────────

/**
 * Reading-log entries the viewer may see: their own, ones they logged for
 * someone (a parent for a little one), and anything the reader shared with
 * the family.
 */
export const readingVisible = (viewer: Viewer): SQL =>
  and(
    eq(readingEntries.familyId, viewer.family.id),
    or(eq(readingEntries.memberId, viewer.member.id), eq(readingEntries.createdByMemberId, viewer.member.id), eq(readingEntries.shared, true)),
  )!;

/** May the viewer change this entry? The reader, or whoever logged it for them. */
export const canChangeEntry = (viewer: Viewer, e: { memberId: string; createdByMemberId: string | null }) => e.memberId === viewer.member.id || e.createdByMemberId === viewer.member.id;

/** Reading-log entries with their book and reader, newest activity first. */
export async function readingLog(viewer: Viewer, opts: { memberId?: string; statuses?: string[]; bookId?: string; limit?: number } = {}) {
  return db
    .select({
      entry: readingEntries,
      book: { id: books.id, title: books.title, author: books.author, coverFileId: books.coverFileId, pageCount: books.pageCount },
      reader: { id: familyMembers.id, name: familyMembers.displayName, color: familyMembers.color },
    })
    .from(readingEntries)
    .innerJoin(books, eq(books.id, readingEntries.bookId))
    .innerJoin(familyMembers, eq(familyMembers.id, readingEntries.memberId))
    .where(
      and(
        readingVisible(viewer),
        opts.memberId ? eq(readingEntries.memberId, opts.memberId) : undefined,
        opts.statuses?.length ? inArray(readingEntries.status, opts.statuses) : undefined,
        opts.bookId ? eq(readingEntries.bookId, opts.bookId) : undefined,
      ),
    )
    .orderBy(desc(readingEntries.updatedAt))
    .limit(opts.limit ?? 500);
}
export type ReadingLogRow = Awaited<ReturnType<typeof readingLog>>[number];
