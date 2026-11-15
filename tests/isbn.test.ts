import { test } from "node:test";
import assert from "node:assert/strict";
import { isbn10to13, mergeLookups, normalizeIsbn, parseGoogleBooks, parseOpenLibrary, publishedYear } from "../src/lib/isbn";

test("normalizes ISBN-10, ISBN-13 and book barcodes", () => {
  assert.equal(normalizeIsbn("0-14-312755-1"), "9780143127550");
  assert.equal(normalizeIsbn("978-0-14-312755-0"), "9780143127550");
  assert.equal(normalizeIsbn("080442957X"), "9780804429573");
  assert.equal(normalizeIsbn("978014312755051699"), "9780143127550"); // EAN + 5-digit add-on
  assert.equal(normalizeIsbn("9780143127551"), null); // bad checksum
  assert.equal(normalizeIsbn("0123456789012"), null); // grocery barcode
  assert.equal(normalizeIsbn(""), null);
  assert.equal(isbn10to13("0143127551"), "9780143127550");
});

test("parses Open Library data", () => {
  const r = parseOpenLibrary(
    {
      "ISBN:9780143127550": {
        title: "Everything I Never Told You",
        authors: [{ name: "Celeste Ng" }],
        publishers: [{ name: "Penguin Books" }],
        publish_date: "2015",
        number_of_pages: 297,
        subjects: [{ name: "Fiction" }],
        cover: { medium: "http://covers.openlibrary.org/b/id/1-M.jpg", large: "https://covers.openlibrary.org/b/id/1-L.jpg" },
      },
    },
    "9780143127550",
  );
  assert.equal(r?.title, "Everything I Never Told You");
  assert.equal(r?.author, "Celeste Ng");
  assert.equal(r?.pageCount, 297);
  assert.equal(r?.coverUrl, "https://covers.openlibrary.org/b/id/1-L.jpg");
  assert.equal(parseOpenLibrary({}, "9780143127550"), null);
});

test("parses Google Books and merges sources", () => {
  const g = parseGoogleBooks(
    {
      totalItems: 1,
      items: [
        {
          volumeInfo: {
            title: "Everything I Never Told You",
            authors: ["Celeste Ng", "Someone Else"],
            publisher: "Penguin",
            publishedDate: "2015-06-30",
            description: "<p>A family <b>novel</b>.</p>",
            pageCount: 320,
            categories: ["Fiction"],
            imageLinks: { thumbnail: "http://books.google.com/books/content?id=x&zoom=1&edge=curl" },
          },
        },
      ],
    },
    "9780143127550",
  );
  assert.equal(g?.coAuthor, "Someone Else");
  assert.equal(g?.description, "A family novel.");
  assert.equal(g?.coverUrl, "https://books.google.com/books/content?id=x&zoom=1");
  const m = mergeLookups("9780143127550", { isbn: "9780143127550", title: "From OL", pageCount: 297 }, g);
  assert.equal(m?.title, "From OL");
  assert.equal(m?.pageCount, 297);
  assert.equal(m?.description, "A family novel.");
  assert.equal(mergeLookups("1", null, null), null);
  assert.equal(parseGoogleBooks({ totalItems: 0 }, "x"), null);
  assert.equal(publishedYear("June 30, 2015"), "2015");
});
