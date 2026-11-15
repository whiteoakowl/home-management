import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookCategories, books, categories } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";

export type Book = typeof books.$inferSelect;
export type BookCategory = { id: string; name: string; color: string | null; sortOrder: number };

/** Books the viewer may see: family books, their own private books, and books shared with them. */
export const bookVisible = (viewer: Viewer) => visibleTo(viewer, { id: books.id, visibility: books.visibility, author: books.createdByMemberId }, "book");

export async function bookCategoryList(viewer: Viewer): Promise<BookCategory[]> {
  return db
    .select({ id: categories.id, name: categories.name, color: categories.color, sortOrder: categories.sortOrder })
    .from(categories)
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "book")))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

/** Every visible book with its category ids. */
export async function listBooks(viewer: Viewer) {
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.familyId, viewer.family.id), bookVisible(viewer)))
    .orderBy(asc(books.title));
  const links = rows.length ? await db.select().from(bookCategories).where(inArray(bookCategories.bookId, rows.map((b) => b.id))) : [];
  const byBook = Map.groupBy(links, (l) => l.bookId);
  return rows.map((b) => ({ ...b, categoryIds: (byBook.get(b.id) ?? []).map((l) => l.categoryId) }));
}
export type BookWithCats = Awaited<ReturnType<typeof listBooks>>[number];

export async function getBook(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [b] = await db.select().from(books).where(and(eq(books.id, id), eq(books.familyId, viewer.family.id), bookVisible(viewer)));
  if (!b) return null;
  const links = await db.select().from(bookCategories).where(eq(bookCategories.bookId, b.id));
  return { ...b, categoryIds: links.map((l) => l.categoryId) };
}

/** Reading statistics for the dashboard. */
export function libraryStats(list: BookWithCats[], cats: BookCategory[], year: string) {
  const done = list.filter((b) => b.status === "completed");
  const thisYear = done.filter((b) => b.finishedOn?.startsWith(year));
  const pagesThisYear = thisYear.reduce((s, b) => s + (b.pageCount ?? 0), 0);
  // "Favourite" = most-read (completed), weighted up by favourites and high ratings.
  const weight = (b: BookWithCats) => (b.status === "completed" ? 1 : 0) + (b.isFavorite ? 1 : 0) + ((b.rating ?? 0) >= 4 ? 1 : 0);
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
    reading: list.filter((b) => b.status === "reading"),
    completed: done.length,
    toRead: list.filter((b) => b.status === "want_to_read" || b.status === "not_started"),
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
