"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { bookCategories, books, categories, readingEntries } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, requireModule, requirePremium, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { mergeLookups, normalizeIsbn, parseGoogleBooks, parseOpenLibrary, type BookLookup } from "@/lib/isbn";
import { bookVisible, canAddBooks, canChangeBook, canChangeEntry, currentLibrarySpace, getBook, LIBRARY_SPACE_COOKIE, type LibrarySpace } from "@/lib/library";
import { BOOK_FORMATS, STATUS_VALUES } from "@/lib/library-config";
import { bookKey, booksFromCsv, isbnsFromText, type ImportedBook } from "@/lib/book-import";
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
  requirePremium(viewer);
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
    requirePremium(viewer);
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
    const format = f.str(fd, "format");
    if (format && !BOOK_FORMATS.some((x) => x.value === format)) return fail("Choose a format.", "format");
    const rating = f.int(fd, "rating");
    if (rating !== null && (rating < 1 || rating > 5)) return fail("Ratings go from 1 to 5 stars.", "rating");
    const pageCount = f.int(fd, "pageCount");
    if (pageCount !== null && (pageCount < 1 || pageCount > 50000)) return fail("Enter a page count between 1 and 50,000.", "pageCount");
    const price = f.num(fd, "price");
    if (price !== null && (price < 0 || price > 100000)) return fail("Enter a price, like 14.99.", "price");

    const catIds = await familyBookCategoryIds(viewer.family.id, f.list(fd, "categoryIds"));
    const { visibility, memberIds } = visibilityFromForm(fd);

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
  requirePremium(viewer);
  const b = await getBook(viewer, String(fd.get("id")));
  if (!b || !canChangeBook(viewer, b)) throw new AuthorizationError("Book not found.");
  await db.delete(books).where(and(eq(books.id, b.id), eq(books.familyId, viewer.family.id)));
  if (b.coverFileId) await deleteFamilyFile(viewer.family.id, b.coverFileId);
  revalidateLibrary();
  redirect("/library/books");
}

export async function toggleBookFavorite(fd: FormData) {
  const viewer = await requireModule("library", "use");
  const b = await getBook(viewer, String(fd.get("id")));
  if (!b || !canChangeBook(viewer, b)) throw new AuthorizationError("Book not found.");
  await db.update(books).set({ isFavorite: !b.isFavorite }).where(eq(books.id, b.id));
  revalidateLibrary();
}

// ─── Reading log (separate from the book) ────────────────────────────────────

/** Reading is personal tracking: anyone who can open the library, on Premium. */
async function reader() {
  const viewer = await requireModule("library", "view");
  requirePremium(viewer);
  return viewer;
}

/** Whose log: yourself, or (parents) a family member, e.g. a little one without a login. */
async function readerFor(viewer: Viewer, raw: string | null) {
  if (!raw || raw === viewer.member.id) return viewer.member.id;
  if (!viewer.isParent || !(await isFamilyMember(viewer, raw))) throw new AuthorizationError("You can only keep your own reading log.");
  return raw;
}

async function ownEntry(viewer: Viewer, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Reading entry not found.");
  const [e] = await db.select().from(readingEntries).where(and(eq(readingEntries.id, id), eq(readingEntries.familyId, viewer.family.id)));
  if (!e || !canChangeEntry(viewer, e)) throw new AuthorizationError("Reading entry not found.");
  return e;
}

/** "Family member finished a book" in the family feed, when the entry is shared and the book is the family's. */
async function announceFinished(viewer: Viewer, entry: { shared: boolean; memberId: string }, b: { id: string; title: string; ownerMemberId: string | null; visibility: string }) {
  if (entry.shared && !b.ownerMemberId && b.visibility === "family") await logActivity(db, viewer.family.id, entry.memberId, "book.finished", `finished reading "${b.title}" 📚`, { module: "library", entityId: b.id });
}

/**
 * Add a book to someone's reading log, or move it along: start, want to read,
 * pause, finish, stop, or read again. One entry per person per book.
 */
export async function logReading(fd: FormData) {
  const viewer = await reader();
  const b = await getBook(viewer, String(fd.get("bookId")));
  if (!b) throw new AuthorizationError("Book not found.");
  const memberId = await readerFor(viewer, f.str(fd, "memberId"));
  const intent = f.str(fd, "intent") ?? "start";
  const today = todayIn(viewer.family.timezone);
  const [old] = await db.select().from(readingEntries).where(and(eq(readingEntries.bookId, b.id), eq(readingEntries.memberId, memberId)));
  if (old && !canChangeEntry(viewer, old)) throw new AuthorizationError("Reading entry not found.");
  const set: Partial<typeof readingEntries.$inferInsert> =
    intent === "want"
      ? { status: "want_to_read" }
      : intent === "pause"
        ? { status: "paused" }
        : intent === "complete"
          ? { status: "completed", startedOn: old?.startedOn ?? today, finishedOn: today, currentPage: b.pageCount ?? old?.currentPage ?? null }
          : intent === "abandon"
            ? { status: "abandoned", finishedOn: today }
            : intent === "again"
              ? { status: "reading", startedOn: today, finishedOn: null, currentPage: null }
              : { status: "reading", startedOn: old?.startedOn ?? today, finishedOn: null };
  if (old) await db.update(readingEntries).set(set).where(eq(readingEntries.id, old.id));
  else
    await db.insert(readingEntries).values({
      familyId: viewer.family.id,
      bookId: b.id,
      memberId,
      status: "reading",
      ...set,
      // Personal-library books stay private unless the reader shares the entry.
      shared: !b.ownerMemberId,
      createdByMemberId: viewer.member.id,
    });
  if (set.status === "completed" && old?.status !== "completed") await announceFinished(viewer, { shared: old?.shared ?? !b.ownerMemberId, memberId }, b);
  revalidateLibrary();
}

/** Progress: current page, dates and notes for a reading-log entry. */
export async function saveReadingEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await reader();
    const e = await ownEntry(viewer, f.str(fd, "id"));
    const [b] = await db.select().from(books).where(eq(books.id, e.bookId));
    if (!b) throw new AuthorizationError("Book not found.");
    const page = f.int(fd, "currentPage");
    if (page !== null && page < 0) return fail("The current page can't be negative.", "currentPage");
    if (page !== null && b.pageCount && page > b.pageCount) return fail(`The book has ${b.pageCount} pages.`, "currentPage");
    const status = f.str(fd, "status") ?? e.status;
    if (!STATUS_VALUES.includes(status)) return fail("Choose a status.", "status");
    const today = todayIn(viewer.family.timezone);
    const startedOn = f.date(fd, "startedOn") ?? (fd.has("startedOn") ? null : e.startedOn);
    let finishedOn = f.date(fd, "finishedOn") ?? (fd.has("finishedOn") ? null : e.finishedOn);
    if (startedOn && finishedOn && finishedOn < startedOn) return fail("The finish date is before the start date.", "finishedOn");
    let currentPage = page ?? e.currentPage;
    let next = status;
    // Reaching the last page finishes the book.
    if (next === "reading" && b.pageCount && currentPage === b.pageCount) next = "completed";
    if (next === "completed") {
      finishedOn ??= today;
      if (b.pageCount) currentPage = b.pageCount;
    }
    if (next !== "completed" && next !== "abandoned") finishedOn = null;
    await db
      .update(readingEntries)
      .set({
        status: next,
        currentPage,
        startedOn: startedOn ?? (next === "reading" || next === "completed" ? today : null),
        finishedOn,
        notes: fd.has("notes") ? f.str(fd, "notes") : e.notes,
        shared: fd.has("sharedField") ? f.bool(fd, "shared") : e.shared,
      })
      .where(eq(readingEntries.id, e.id));
    if (next === "completed" && e.status !== "completed") await announceFinished(viewer, { shared: fd.has("sharedField") ? f.bool(fd, "shared") : e.shared, memberId: e.memberId }, b);
    revalidateLibrary();
    return ok(next === "completed" && e.status !== "completed" ? "Finished! 🎉" : "Reading log saved.");
  });
}

/** Share (or stop sharing) a reading-log entry with the family. */
export async function toggleReadingShared(fd: FormData) {
  const viewer = await reader();
  const e = await ownEntry(viewer, f.str(fd, "id"));
  await db.update(readingEntries).set({ shared: !e.shared }).where(eq(readingEntries.id, e.id));
  revalidateLibrary();
}

/** Take a book out of someone's reading log (the book stays in the library). */
export async function removeReadingEntry(fd: FormData) {
  const viewer = await requireModule("library", "view");
  const e = await ownEntry(viewer, f.str(fd, "id"));
  await db.delete(readingEntries).where(eq(readingEntries.id, e.id));
  revalidateLibrary();
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

// ─── Import ──────────────────────────────────────────────────────────────────

/**
 * Import books into the library that's open (Family Library or My Library):
 * a CSV from Goodreads, StoryGraph, LibraryThing or the family's own sheet,
 * or a pasted list of ISBNs (looked up online, up to 10 at a time).
 * Books already in that library (same ISBN, or same title and author) are skipped.
 * Shelves ("read", "currently reading", "to read") go into the importer's own
 * reading log only if they tick that box: adding a book never sets a reading status.
 */
export async function importBooks(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("library", "view");
    requirePremium(viewer);
    const space = await currentLibrarySpace();
    if (!canAddBooks(viewer, space)) throw new AuthorizationError("You can't add books to the Family Library.");
    const personal = space === "mine";
    const toLog = f.bool(fd, "addToLog");

    let incoming: ImportedBook[] = [];
    let note = "";
    const file = fd.get("file");
    const pasted = f.str(fd, "isbns");
    if (file instanceof File && file.size > 0) {
      if (file.size > 5_000_000) return fail("That file is too big. Spreadsheets up to 5 MB can be imported.", "file");
      if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) return fail("Choose a CSV file. In Excel, Numbers or Google Sheets use File → Download / Export → CSV.", "file");
      const parsed = booksFromCsv(await file.text());
      if (parsed.error) return fail(parsed.error, "file");
      incoming = parsed.books;
      if (parsed.skipped) note = ` ${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} without a title ${parsed.skipped === 1 ? "was" : "were"} skipped.`;
    } else if (pasted) {
      const { isbns, invalid, extra } = isbnsFromText(pasted, 10);
      if (!isbns.length) return fail("Those don't look like ISBNs. Book barcodes start with 978 or 979.", "isbns");
      const found = await Promise.all(
        isbns.map(async (isbn) => {
          const [ol, gb] = await Promise.allSettled([
            getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`).then((j) => parseOpenLibrary(j, isbn)),
            getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${process.env.GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(process.env.GOOGLE_BOOKS_API_KEY)}` : ""}`).then((j) => parseGoogleBooks(j, isbn)),
          ]);
          return { isbn, book: mergeLookups(isbn, ol.status === "fulfilled" ? ol.value : null, gb.status === "fulfilled" ? gb.value : null) };
        }),
      );
      const missing = found.filter((x) => !x.book).map((x) => x.isbn);
      incoming = found
        .filter((x) => x.book?.title)
        .map(({ isbn, book: b }) => ({ title: b!.title!, author: b!.author ?? null, isbn, pageCount: b!.pageCount ?? null, publisher: b!.publisher ?? null, publishedDate: b!.publishedDate ?? null, format: null, rating: null, readingStatus: null, finishedOn: null, coverUrl: b!.coverUrl ?? null, description: b!.description ?? null, subtitle: b!.subtitle ?? null }));
      if (missing.length) note += ` We couldn't find ${missing.join(", ")}; add ${missing.length === 1 ? "it" : "them"} with Add Book.`;
      if (invalid) note += ` ${invalid} entr${invalid === 1 ? "y wasn't an ISBN" : "ies weren't ISBNs"}.`;
      if (extra) note += ` Only the first 10 were imported; paste the rest next.`;
    } else return fail("Choose a spreadsheet file or paste some ISBNs.", "file");

    // Skip books this library already has.
    const have = await db
      .select({ title: books.title, author: books.author, isbn: books.isbn })
      .from(books)
      .where(and(eq(books.familyId, viewer.family.id), personal ? eq(books.ownerMemberId, viewer.member.id) : isNull(books.ownerMemberId)));
    const seen = new Set(have.flatMap((b) => [bookKey(b), bookKey({ ...b, isbn: null })]));
    const fresh = incoming.filter((b) => {
      const keys = [bookKey(b), bookKey({ ...b, isbn: null })];
      if (keys.some((k) => seen.has(k))) return false;
      keys.forEach((k) => seen.add(k));
      return true;
    });
    const dupes = incoming.length - fresh.length;
    if (!fresh.length) return ok(`Nothing new to add: ${dupes ? `all ${dupes} book${dupes === 1 ? " is" : "s are"} already in ${personal ? "My Library" : "the library"}.` : "no books found."}${note}`);

    // Covers for looked-up ISBNs (a few at a time, so it stays quick).
    const covers = await Promise.all(fresh.map((b) => (b.coverUrl ? saveCoverFromUrl(viewer, b.coverUrl) : Promise.resolve(null))));
    const today = todayIn(viewer.family.timezone);
    let logged = 0;
    await db.transaction(async (tx) => {
      for (let i = 0; i < fresh.length; i += 200) {
        const chunk = fresh.slice(i, i + 200);
        const rows = await tx
          .insert(books)
          .values(
            chunk.map((b, j) => ({
              familyId: viewer.family.id,
              title: b.title,
              subtitle: b.subtitle ?? null,
              author: b.author,
              isbn: b.isbn,
              publisher: b.publisher,
              publishedDate: b.publishedDate,
              description: b.description ?? null,
              pageCount: b.pageCount,
              format: b.format,
              rating: b.rating,
              coverFileId: covers[i + j] ?? null,
              visibility: personal ? ("private" as const) : ("family" as const),
              createdByMemberId: viewer.member.id,
              ownerMemberId: personal ? viewer.member.id : null,
            })),
          )
          .returning({ id: books.id });
        if (toLog) {
          const entries = chunk
            .map((b, j) => ({ b, id: rows[j]!.id }))
            .filter(({ b }) => b.readingStatus)
            .map(({ b, id }) => ({
              familyId: viewer.family.id,
              bookId: id,
              memberId: viewer.member.id,
              status: b.readingStatus!,
              startedOn: b.readingStatus === "reading" ? today : null,
              finishedOn: b.readingStatus === "completed" ? b.finishedOn : null,
              currentPage: b.readingStatus === "completed" ? b.pageCount : null,
              shared: !personal,
              createdByMemberId: viewer.member.id,
            }));
          if (entries.length) await tx.insert(readingEntries).values(entries);
          logged += entries.length;
        }
      }
      if (!personal) await logActivity(tx, viewer.family.id, viewer.member.id, "book.added", `added ${fresh.length} book${fresh.length === 1 ? "" : "s"} to the library`, { module: "library" });
    });
    revalidateLibrary();
    return ok(
      `Added ${fresh.length} book${fresh.length === 1 ? "" : "s"} to ${personal ? "My Library" : "the library"}.` +
        (dupes ? ` ${dupes} ${dupes === 1 ? "was" : "were"} already there.` : "") +
        (logged ? ` ${logged} added to your reading log.` : "") +
        note,
    );
  });
}
