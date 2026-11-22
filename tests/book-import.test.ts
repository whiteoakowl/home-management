import { test } from "node:test";
import assert from "node:assert/strict";
import { bookKey, booksFromCsv, isbnsFromText, parseCsv } from "../src/lib/book-import";

test("CSV: quotes, commas and new lines inside quotes", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n'), [
    ["a", "b"],
    ["x, y", 'say "hi"\nthere'],
  ]);
});

test("Goodreads export: title, author, ISBN13 wrapper, pages, rating, shelf, date read", () => {
  const csv = [
    "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf",
    '1,"The Hunger Games (The Hunger Games, #1)",Suzanne Collins,"Collins, Suzanne",,"=""0439023483""","=""9780439023481""",5,4.3,Scholastic Press,Hardcover,374,2008,2008,2024/03/02,2024/01/01,,,read',
    '2,Charlotte\'s Web,E.B. White,"White, E.B.",,"=""""","=""""",0,4.2,HarperCollins,Paperback,184,2001,1952,,2024/01/01,to-read,to-read (#1),to-read',
    ",,,,,,,,,,,,,,,,,,",
  ].join("\n");
  const { books, skipped, error } = booksFromCsv(csv);
  assert.equal(error, undefined);
  assert.equal(skipped, 0);
  assert.equal(books.length, 2);
  assert.deepEqual(
    { ...books[0], title: books[0]!.title },
    { title: "The Hunger Games (The Hunger Games, #1)", author: "Suzanne Collins", isbn: "9780439023481", pageCount: 374, publisher: "Scholastic Press", publishedDate: "2008", format: "hardcover", rating: 5, readingStatus: "completed", finishedOn: "2024-03-02" },
  );
  assert.equal(books[1]!.isbn, null);
  assert.equal(books[1]!.rating, null);
  assert.equal(books[1]!.format, "paperback");
  assert.equal(books[1]!.readingStatus, "want_to_read");
});

test("a plain family sheet only needs a Title column", () => {
  const { books, skipped } = booksFromCsv("Title,Author\nGoodnight Moon,Margaret Wise Brown\n,No title here\n");
  assert.equal(books.length, 1);
  assert.equal(books[0]!.readingStatus, null);
  assert.equal(skipped, 1);
  assert.match(booksFromCsv("Name of book\nx").error ?? "", /Title/);
  assert.ok(booksFromCsv("Title").error);
});

test("ISBN paste: valid, invalid, duplicates and the limit", () => {
  const r = isbnsFromText("9780439023481, 0439023483\nnot-an-isbn 9780061120084", 10);
  assert.deepEqual(r.isbns, ["9780439023481", "9780061120084"]);
  assert.equal(r.invalid, 1);
  assert.equal(isbnsFromText("9780439023481 9780061120084", 1).extra, 1);
});

test("duplicate detection by ISBN, or title and author", () => {
  assert.equal(bookKey({ title: "X", author: null, isbn: "9780439023481" }), "isbn:9780439023481");
  assert.equal(bookKey({ title: "Charlotte's Web", author: "E. B. White", isbn: null }), bookKey({ title: "charlottes web", author: "E.B. White", isbn: null }));
});
