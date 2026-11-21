import type { Metadata } from "next";
import Link from "next/link";
import { LibraryBig, Plus, ScanBarcode, Search } from "lucide-react";
import { BookGrid, BookRow } from "@/components/library/book-card";
import { LibraryTabs } from "@/components/library/library-tabs";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { bookCategoryList, canAddBooks, listBooks, type BookWithCats } from "@/lib/library";
import {
  BOOK_FORMATS,
  LIBRARY_SORTS,
  LIBRARY_VIEWS,
  percentRead,
  READING_STATUSES,
  type LibraryView,
} from "@/lib/library-config";
import { cn } from "@/lib/utils";
import { libraryViewer } from "../shared";

export const metadata: Metadata = { title: "Books" };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export default async function BooksPage({
  searchParams,
}: PageProps<"/library/books">) {
  const viewer = await libraryViewer();
  const space = viewer.librarySpace;
  const canEdit = canAddBooks(viewer, space);
  const sp = await searchParams;
  const view: LibraryView = LIBRARY_VIEWS.some((v) => v.key === sp.view)
    ? (sp.view as LibraryView)
    : "grid";
  const q = str(sp.q).trim();
  const status = str(sp.status);
  const category = str(sp.category);
  const format = str(sp.format);
  const favorite = sp.favorite === "1";
  const minRating = Number(str(sp.rating)) || 0;
  const sort = LIBRARY_SORTS.some((s) => s.value === sp.sort)
    ? str(sp.sort)
    : "title";

  const [all, cats] = await Promise.all([
    listBooks(viewer, space),
    bookCategoryList(viewer),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const needle = q.toLowerCase();
  const shown = all
    .filter(
      (b) =>
        (!needle ||
          [
            b.title,
            b.subtitle,
            b.author,
            b.coAuthor,
            b.isbn,
            b.genre,
            b.publisher,
            b.notes,
          ].some((x) => x?.toLowerCase().includes(needle))) &&
        (!status ||
          (status === "to_read"
            ? b.reading?.status === "want_to_read"
            : b.reading?.status === status)) &&
        (!category ||
          (category === "none"
            ? !b.categoryIds.length
            : b.categoryIds.includes(category))) &&
        (!format || b.format === format) &&
        (!favorite || b.isFavorite) &&
        (!minRating || (b.rating ?? 0) >= minRating),
    )
    .sort((a, b) => {
      if (sort === "author")
        return (
          (a.author ?? "~").localeCompare(b.author ?? "~") ||
          a.title.localeCompare(b.title)
        );
      if (sort === "recent") return +b.createdAt - +a.createdAt;
      if (sort === "rating")
        return (
          (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title)
        );
      if (sort === "progress") return percentRead(b.reading, b.pageCount) - percentRead(a.reading, a.pageCount);
      return a.title.localeCompare(b.title);
    });
  const filtered = !!(
    q ||
    status ||
    category ||
    format ||
    favorite ||
    minRating
  );
  const params = (p: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({
      view,
      q,
      status,
      category,
      format,
      favorite: favorite ? "1" : "",
      rating: minRating ? String(minRating) : "",
      sort,
      ...p,
    }))
      if (v) u.set(k, v);
    return `/library/books?${u}`;
  };

  const groups: { key: string; title: string; books: BookWithCats[] }[] =
    view === "category"
      ? [
          ...cats.map((c) => ({
            key: c.id,
            title: c.name,
            books: shown.filter((b) => b.categoryIds.includes(c.id)),
          })),
          {
            key: "none",
            title: "No category",
            books: shown.filter((b) => !b.categoryIds.length),
          },
        ].filter((g) => g.books.length)
      : view === "author"
        ? [...Map.groupBy(shown, (b) => b.author ?? "Unknown author").entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([a, bs]) => ({ key: a, title: a, books: bs }))
        : view === "status"
          ? READING_STATUSES.map((s) => ({
              key: s.value,
              title: s.label,
              books: shown.filter((b) => b.reading?.status === s.value),
            })).filter((g) => g.books.length)
          : [];

  return (
    <>
      <PageHeader
        eyebrow="Book Library"
        title="All books"
        description={`${all.length} book${all.length === 1 ? "" : "s"} in your library.`}
        actions={
          canEdit && (
            <>
              <ButtonLink
                href="/library/scan"
                variant="secondary"
                icon={<ScanBarcode className="size-4" />}
              >
                Scan Barcode
              </ButtonLink>
              <ButtonLink
                href="/library/add"
                icon={<Plus className="size-4" />}
              >
                Add Book
              </ButtonLink>
            </>
          )
        }
      />
      <LibraryTabs
        active="books"
        canEdit={canEdit}
        space={space}
      />

      <Card className="mb-5 !p-4">
        <form action="/library/books" className="flex flex-col gap-3">
          <input type="hidden" name="view" value={view} />
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search books</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Title, author, ISBN, genre…"
                className="pl-9"
              />
            </label>
            <Button type="submit">Search</Button>
          </div>
          <details className="group" open={filtered || undefined}>
            <summary className="cursor-pointer list-none text-sm font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">
                Show filters &amp; sorting ▾
              </span>
              <span className="hidden group-open:inline">Hide filters ▴</span>
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                name="status"
                defaultValue={status}
                aria-label="My reading status"
              >
                <option value="">My reading status: any</option>
                {READING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Select
                name="category"
                defaultValue={category}
                aria-label="Category"
              >
                <option value="">All categories</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="none">No category</option>
              </Select>
              <Select name="format" defaultValue={format} aria-label="Format">
                <option value="">Any format</option>
                {BOOK_FORMATS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Select
                name="rating"
                defaultValue={minRating ? String(minRating) : ""}
                aria-label="Minimum rating"
              >
                <option value="">Any rating</option>
                {[5, 4, 3].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                    {n < 5 ? " & up" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-3 text-sm">
                <input
                  type="checkbox"
                  name="favorite"
                  value="1"
                  defaultChecked={favorite}
                  className="size-4 accent-primary-600"
                />{" "}
                Favorites only
              </label>
              <Select
                name="sort"
                defaultValue={sort}
                aria-label="Sort by"
                className="w-auto"
              >
                {LIBRARY_SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    Sort: {s.label}
                  </option>
                ))}
              </Select>
              <Button type="submit">Apply</Button>
              {filtered && (
                <Link
                  href={`/library/books?view=${view}`}
                  className="px-2 text-sm font-medium text-muted hover:text-ink"
                >
                  Clear filters
                </Link>
              )}
            </div>
          </details>
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {shown.length} {filtered ? "matching" : ""} book
          {shown.length === 1 ? "" : "s"}
        </p>
        <nav
          className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-sunken p-1"
          aria-label="View"
        >
          {LIBRARY_VIEWS.map((v) => (
            <Link
              key={v.key}
              href={params({ view: v.key })}
              aria-current={view === v.key ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                view === v.key
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              {v.label}
            </Link>
          ))}
        </nav>
      </div>

      {!shown.length ? (
        <Card>
          <EmptyState
            icon={<LibraryBig />}
            title={all.length ? "No books match" : "Your library is empty."}
            description={
              all.length
                ? "Try clearing a filter or searching for something else."
                : "Scan a book's barcode or add one by hand."
            }
            action={
              canEdit &&
              !all.length && (
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink
                    href="/library/add"
                    icon={<Plus className="size-4" />}
                  >
                    Add Book
                  </ButtonLink>
                  <ButtonLink
                    href="/library/scan"
                    variant="secondary"
                    icon={<ScanBarcode className="size-4" />}
                  >
                    Scan Barcode
                  </ButtonLink>
                </div>
              )
            }
          />
        </Card>
      ) : view === "grid" ? (
        <BookGrid books={shown} />
      ) : view === "list" ? (
        <ul className="flex flex-col gap-2">
          {shown.map((b) => (
            <BookRow
              key={b.id}
              b={b}
              categories={b.categoryIds
                .map((id) => catName.get(id)!)
                .filter(Boolean)}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-3 flex items-baseline gap-2 border-b border-line pb-2 text-lg font-semibold">
                {g.title}{" "}
                <span className="font-sans text-sm font-normal text-muted">
                  {g.books.length}
                </span>
              </h2>
              <BookGrid books={g.books} compact />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
