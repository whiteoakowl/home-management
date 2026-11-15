"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { bookCategories, books, categories } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { mergeLookups, normalizeIsbn, parseGoogleBooks, parseOpenLibrary, type BookLookup } from "@/lib/isbn";
import { bookVisible, canAddBooks, canChangeBook, currentLibrarySpace, getBook, LIBRARY_SPACE_COOKIE, type LibrarySpace } from "@/lib/library";
import { BOOK_FORMATS, STATUS_VALUES } from "@/lib/library-config";
import { f, familyMemberIdOrNull, saveRecordAccess, visibilityFromForm } from "@/lib/records";
import { safeFetch } from "@/lib/safe-fetch";

const revalidateLibrary = () => {
  revalidatePath("/library", "layout");
  revalidatePath("/");
};

// ─── ISBN lookup ─────────────────────────────────────────────────────────────

export type IsbnLookupResult = {
  ok: boolean;
  isbn?: string;
  book?: BookLookup;
  /** The family already has this book. */
  existing?: { id: string; title: string };
  message?: string;
};

async function getJson(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "HomeLibrary/1.0" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Identify a book from a scanned or typed ISBN. Asks Open Library and Google
 * Books together and merges what they know. Never saves anything: the person
 * confirms or edits the details first.
 */
export async function lookupIsbn(raw: string): Promise<IsbnLookupResult> {
  const viewer = await requireModule("library", "view");
  const space = await currentLibrarySpace();
  if (!canAddBooks(viewer, space)) throw new AuthorizationError("You can't add books.");
  const isbn = normalizeIsbn(raw);
  if (!isbn) return { ok: false, message: "That doesn't look like a book barcode or ISBN. Book barcodes start with 978 or 979." };

  const [dupe] = await db
    .select({ id: books.id, title: books.title })
    .from(books)
    .where(and(eq(books.familyId, viewer.family.id), eq(books.isbn, isbn), bookVisible(viewer), space === "mine" ? eq(books.ownerMemberId, viewer.member.id) : isNull(books.ownerMemberId)))
    .limit(1);

  const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}` : "";
  const [ol, gb] = await Promise.allSettled([
    getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`).then((j) => parseOpenLibrary(j, isbn)),
    getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`).then((j) => parseGoogleBooks(j, isbn)),
  ]);
  const book = mergeLookups(isbn, ol.status === "fulfilled" ? ol.value : null, gb.status === "fulfilled" ? gb.value : null);
  const existing = dupe ? { id: dupe.id, title: dupe.title } : undefined;
  if (book) return { ok: true, isbn, book, existing };
  const unreachable = ol.status === "rejected" && gb.status === "rejected";
  return {
    ok: false,
    isbn,
    existing,
    message: unreachable
      ? "Book lookup isn't available right now. Enter the details below; the ISBN is filled in."
      : "We couldn't find that ISBN. Enter the details below; the ISBN is filled in.",
  };
}

// ─── Books ───────────────────────────────────────────────────────────────────

async function familyBookCategoryIds(familyId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.familyId, familyId), eq(categories.domain, "book"), inArray(categories.id, ids)));
  return rows.map((r) => r.id);
}

/** Download a cover found by the ISBN lookup into the family's own storage. */
async function saveCoverFromUrl(viewer: Viewer, url: string | null) {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const img = await safeFetch(url, { maxBytes: 5_000_000, accept: "image/*", timeoutMs: 6000 });
    const type = img.contentType.split(";")[0]!.trim();
    if (!type.startsWith("image/") || img.body.byteLength < 200) return null; // Open Library sends a 1×1 gif when there's no cover
    return await saveUpload(viewer, new File([new Uint8Array(img.body)], "cover", { type }));
  } catch {
    return null;
  }
}

export async function saveBook(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("library", "view");
    const id = f.str(fd, "id");
    const existing = id ? await getBook(viewer, id) : null;
    if (id && (!existing || !canChangeBook(viewer, existing))) throw new AuthorizationError("Book not found.");
    // New books go into whichever library is open: the Family Library or the viewer's personal one.
    const personal = existing ? !!existing.ownerMemberId : (await currentLibrarySpace()) === "mine";
    if (!existing && !canAddBooks(viewer, personal ? "mine" : "family")) throw new AuthorizationError("You can't add books to the Family Library.");

    const title = f.str(fd, "title");
    if (!title) return fail("Enter the book's title.", "title");
    const rawIsbn = f.str(fd, "isbn");
    const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : null;
    if (rawIsbn && !isbn) return fail("That ISBN doesn't look right. Check the digits, or leave it blank.", "isbn");
    const status = f.str(fd, "status") ?? "not_started";
    if (!STATUS_VALUES.includes(status)) return fail("Choose a reading status.", "status");
    const format = f.str(fd, "format");
    if (format && !BOOK_FORMATS.some((x) => x.value === format)) return fail("Choose a format.", "format");
    const rating = f.int(fd, "rating");
    if (rating !== null && (rating < 1 || rating > 5)) return fail("Ratings go from 1 to 5 stars.", "rating");
    const pageCount = f.int(fd, "pageCount");
    if (pageCount !== null && (pageCount < 1 || pageCount > 50000)) return fail("Enter a page count between 1 and 50,000.", "pageCount");
    let currentPage = f.int(fd, "currentPage");
    if (currentPage !== null && currentPage < 0) return fail("The current page can't be negative.", "currentPage");
    if (currentPage !== null && pageCount && currentPage > pageCount) return fail(`The book has ${pageCount} pages.`, "currentPage");
    const price = f.num(fd, "price");
    if (price !== null && (price < 0 || price > 100000)) return fail("Enter a price, like 14.99.", "price");

    const today = todayIn(viewer.family.timezone);
    let startedOn = f.date(fd, "startedOn");
    let finishedOn = f.date(fd, "finishedOn");
    if (startedOn && finishedOn && finishedOn < startedOn) return fail("The finish date is before the start date.", "finishedOn");
    if ((status === "reading" || status === "completed") && !startedOn) startedOn = existing?.startedOn ?? (status === "reading" ? today : null);
    if (status === "completed") {
      finishedOn ??= today;
      if (pageCount) currentPage = pageCount;
    }

    const catIds = await familyBookCategoryIds(viewer.family.id, f.list(fd, "categoryIds"));
    const { visibility, memberIds } = visibilityFromForm(fd);
    const readerId = f.str(fd, "readerMemberId");

    let coverFileId: string | null | undefined;
    const uploaded = await saveUpload(viewer, fd.get("cover"));
    if (uploaded) coverFileId = uploaded;
    else if (fd.get("removeImage") === "1") coverFileId = null;
    else if (!existing?.coverFileId) coverFileId = (await saveCoverFromUrl(viewer, f.str(fd, "coverUrl"))) ?? undefined;

    const values = {
      title,
      subtitle: f.str(fd, "subtitle"),
      author: f.str(fd, "author"),
      coAuthor: f.str(fd, "coAuthor"),
      isbn,
      publisher: f.str(fd, "publisher"),
      publishedDate: f.str(fd, "publishedDate"),
      description: f.str(fd, "description"),
      genre: f.str(fd, "genre"),
      pageCount,
      edition: f.str(fd, "edition"),
      format,
      acquiredOn: f.date(fd, "acquiredOn"),
      purchaseLocation: f.str(fd, "purchaseLocation"),
      priceCents: price === null ? null : Math.round(price * 100),
      rating,
      notes: f.str(fd, "notes"),
      isFavorite: f.bool(fd, "isFavorite"),
      status,
      readerMemberId: readerId && (await isFamilyMember(viewer, readerId)) ? readerId : null,
      startedOn,
      finishedOn: status === "completed" || status === "abandoned" ? finishedOn : null,
      currentPage,
      readingNotes: f.str(fd, "readingNotes"),
      visibility: personal ? ("private" as const) : visibility,
      ...(coverFileId !== undefined ? { coverFileId } : {}),
    };

    let bookId = id;
    await db.transaction(async (tx) => {
      if (existing) {
        await tx.update(books).set(values).where(and(eq(books.id, existing.id), eq(books.familyId, viewer.family.id)));
        await tx.delete(bookCategories).where(eq(bookCategories.bookId, existing.id));
      } else {
        const [row] = await tx
          .insert(books)
          .values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id, ownerMemberId: personal ? viewer.member.id : null })
          .returning({ id: books.id });
        bookId = row!.id;
        if (!personal && visibility === "family") await logActivity(tx, viewer.family.id, viewer.member.id, "book.added", `added "${title}" to the library`, { module: "library", entityId: bookId });
      }
      if (catIds.length) await tx.insert(bookCategories).values(catIds.map((categoryId) => ({ bookId: bookId!, categoryId })));
      await saveRecordAccess(tx, viewer.family.id, "book", bookId!, personal ? [] : memberIds);
    });
    if (existing?.coverFileId && coverFileId !== undefined && coverFileId !== existing.coverFileId) await deleteFamilyFile(viewer.family.id, existing.coverFileId);
    if (!personal && visibility === "family" && existing && existing.status !== "completed" && status === "completed") {
      await logActivity(db, viewer.family.id, viewer.member.id, "book.finished", `finished reading "${title}" 📚`, { module: "library", entityId: bookId! });
    }
    revalidateLibrary();
    if (fd.get("then") === "view") redirect(`/library/books/${bookId}`);
    return ok(existing ? "Book saved." : `"${title}" added to ${personal ? "My Library" : "the library"}.`);
  });
}

async function isFamilyMember(viewer: Viewer, memberId: string) {
  return !!(await familyMemberIdOrNull(viewer.family.id, memberId));
}

export async function deleteBook(fd: FormData) {
  const viewer = await requireModule("library", "view");
  const b = await getBook(viewer, String(fd.get("id")));
  if (!b || !canChangeBook(viewer, b)) throw new AuthorizationError("Book not found.");
  await db.delete(books).where(and(eq(books.id, b.id), eq(books.familyId, viewer.family.id)));
  if (b.coverFileId) await deleteFamilyFile(viewer.family.id, b.coverFileId);
  revalidateLibrary();
  redirect("/library/books");
}

export async function toggleBookFavorite(fd: FormData) {
  const viewer = await requireModule("library", "view");
  const b = await getBook(viewer, String(fd.get("id")));
  if (!b || !canChangeBook(viewer, b)) throw new AuthorizationError("Book not found.");
  await db.update(books).set({ isFavorite: !b.isFavorite }).where(eq(books.id, b.id));
  revalidateLibrary();
}

/** Reading progress: current page, start, pause, finish, or give up. */
export async function updateReading(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("library", "view");
    const b = await getBook(viewer, String(fd.get("id")));
    if (!b || !canChangeBook(viewer, b)) throw new AuthorizationError("Book not found.");
    const today = todayIn(viewer.family.timezone);
    const intent = f.str(fd, "intent") ?? "progress";
    const set: Partial<typeof books.$inferInsert> = {};
    if (intent === "progress") {
      const page = f.int(fd, "currentPage");
      if (page === null || page < 0) return fail("Enter the page you're on.", "currentPage");
      if (b.pageCount && page > b.pageCount) return fail(`The book has ${b.pageCount} pages.`, "currentPage");
      set.currentPage = page;
      if (b.status !== "reading") set.status = "reading";
      set.startedOn = b.startedOn ?? today;
      if (b.pageCount && page === b.pageCount) {
        set.status = "completed";
        set.finishedOn = today;
      }
    } else if (intent === "start") {
      Object.assign(set, { status: "reading", startedOn: b.startedOn ?? today, finishedOn: null });
    } else if (intent === "pause") {
      set.status = "paused";
    } else if (intent === "complete") {
      Object.assign(set, { status: "completed", startedOn: b.startedOn ?? today, finishedOn: today, currentPage: b.pageCount ?? b.currentPage });
    } else if (intent === "abandon") {
      Object.assign(set, { status: "abandoned", finishedOn: today });
    } else return fail("Unknown action.");
    const notes = f.str(fd, "readingNotes");
    if (notes !== null) set.readingNotes = notes;
    await db.update(books).set(set).where(eq(books.id, b.id));
    if (!b.ownerMemberId && b.visibility === "family" && set.status === "completed" && b.status !== "completed") {
      await logActivity(db, viewer.family.id, viewer.member.id, "book.finished", `finished reading "${b.title}" 📚`, { module: "library", entityId: b.id });
    }
    revalidateLibrary();
    return ok(set.status === "completed" ? "Finished! 🎉" : "Progress saved.");
  });
}

// ─── Categories (shared `categories` table, domain 'book') ──────────────────

async function bookCategory(viewer: Viewer, id: string | null) {
  if (!id) return null;
  const [c] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.familyId, viewer.family.id), eq(categories.domain, "book")));
  return c ?? null;
}

export async function saveBookCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("library", "edit");
    const name = f.str(fd, "name");
    if (!name) return fail("Name the category.", "name");
    if (name.length > 60) return fail("Keep category names under 60 characters.", "name");
    const id = f.str(fd, "id");
    const existing = await bookCategory(viewer, id);
    if (id && !existing) throw new AuthorizationError("Category not found.");
    const [dupe] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "book"), eq(categories.name, name), existing ? ne(categories.id, existing.id) : undefined));
    if (dupe) return fail("You already have a category with that name.", "name");
    const color = f.str(fd, "color");
    if (existing) await db.update(categories).set({ name, color }).where(eq(categories.id, existing.id));
    else {
      const count = await db.$count(categories, and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "book")));
      await db.insert(categories).values({ familyId: viewer.family.id, domain: "book", name, color, sortOrder: count });
    }
    revalidateLibrary();
    return ok(existing ? "Category renamed." : "Category added.");
  });
}

/** Delete a category; its books can move to another category first. */
export async function deleteBookCategory(fd: FormData) {
  const viewer = await requireModule("library", "edit");
  const c = await bookCategory(viewer, f.str(fd, "id"));
  if (!c) return;
  const target = await bookCategory(viewer, f.str(fd, "moveTo"));
  await db.transaction(async (tx) => {
    if (target && target.id !== c.id) await moveLinks(tx, c.id, target.id);
    await tx.delete(categories).where(eq(categories.id, c.id));
  });
  revalidateLibrary();
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function moveLinks(tx: Tx, fromId: string, toId: string) {
  const links = await tx.select({ bookId: bookCategories.bookId }).from(bookCategories).where(eq(bookCategories.categoryId, fromId));
  if (links.length) await tx.insert(bookCategories).values(links.map((l) => ({ bookId: l.bookId, categoryId: toId }))).onConflictDoNothing();
  await tx.delete(bookCategories).where(eq(bookCategories.categoryId, fromId));
}

/** Move every book in one category to another. */
export async function moveCategoryBooks(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("library", "edit");
    const from = await bookCategory(viewer, f.str(fd, "id"));
    const to = await bookCategory(viewer, f.str(fd, "moveTo"));
    if (!from || !to) return fail("Choose a category to move the books to.", "moveTo");
    if (from.id === to.id) return fail("Pick a different category.", "moveTo");
    await db.transaction((tx) => moveLinks(tx, from.id, to.id));
    revalidateLibrary();
    return ok(`Moved the books to ${to.name}.`);
  });
}

/** Move a category up or down in the family's order. */
export async function reorderBookCategory(fd: FormData) {
  const viewer = await requireModule("library", "edit");
  const id = f.str(fd, "id");
  const dir = fd.get("dir") === "up" ? -1 : 1;
  const list = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "book")))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.transaction(async (tx) => {
    for (const [k, c] of list.entries()) await tx.update(categories).set({ sortOrder: k }).where(eq(categories.id, c.id));
  });
  revalidateLibrary();
}

/** Button form of updateReading (start / pause / complete / abandon). */
export async function setReadingStatus(fd: FormData) {
  await updateReading(undefined, fd);
}

/** Form-modal version of deleteBookCategory. */
export async function removeBookCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await deleteBookCategory(fd);
    return ok("Category deleted.");
  });
}

/** Switch between the Family Library and My Library (remembered per browser). */
export async function setLibrarySpace(fd: FormData) {
  await requireModule("library", "view");
  const space: LibrarySpace = fd.get("space") === "mine" ? "mine" : "family";
  (await cookies()).set(LIBRARY_SPACE_COOKIE, space, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidateLibrary();
  redirect("/library");
}
