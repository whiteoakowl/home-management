import { boolean, date, index, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { categories, families, familyMembers, files, visibility } from "./core";

/**
 * Book Library. Categories reuse the shared `categories` table (domain 'book')
 * and a book can sit in several categories (book_categories).
 */
export const books = pgTable(
  "books",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    author: text("author"),
    coAuthor: text("co_author"),
    isbn: text("isbn"),
    publisher: text("publisher"),
    /** As published: "2014", "2014-03" or "2014-03-18". */
    publishedDate: text("published_date"),
    coverFileId: uuid("cover_file_id").references(() => files.id, { onDelete: "set null" }),
    description: text("description"),
    genre: text("genre"),
    pageCount: integer("page_count"),
    edition: text("edition"),
    /** hardcover | paperback | ebook | audiobook | other */
    format: text("format"),
    acquiredOn: date("acquired_on"),
    purchaseLocation: text("purchase_location"),
    priceCents: integer("price_cents"),
    rating: integer("rating"),
    notes: text("notes"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    /** want_to_read | not_started | reading | paused | completed | abandoned */
    status: text("status").notNull().default("not_started"),
    readerMemberId: uuid("reader_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    startedOn: date("started_on"),
    finishedOn: date("finished_on"),
    currentPage: integer("current_page"),
    readingNotes: text("reading_notes"),
    visibility: visibility("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("books_family_idx").on(t.familyId), index("books_isbn_idx").on(t.familyId, t.isbn)],
);

export const bookCategories = pgTable(
  "book_categories",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.categoryId] }), index("book_categories_category_idx").on(t.categoryId)],
);
