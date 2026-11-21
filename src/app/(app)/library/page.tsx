import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { and, eq } from "drizzle-orm";
import { BookMarked, BookOpen, CheckCircle2, Clock, Heart, LibraryBig, PenLine, Plus, ScanBarcode, Tags, TrendingUp } from "lucide-react";
import { db } from "@/db";
import { sectionLayouts } from "@/db/schema";
import { DashboardCustomizer } from "@/components/dashboard/customizer";
import { BookGrid } from "@/components/library/book-card";
import { BookCover } from "@/components/library/book-cover";
import { LibraryTabs } from "@/components/library/library-tabs";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { bookCategoryList, canAddBooks, libraryStats, listBooks } from "@/lib/library";
import { percentRead } from "@/lib/library-config";
import { cn } from "@/lib/utils";
import { resolveSectionLayout, sectionTitles } from "@/lib/widgets";
import { libraryViewer } from "./shared";

export const metadata: Metadata = { title: "Book Library" };

const SPAN = { sm: "col-span-1", md: "col-span-1 md:col-span-2", lg: "col-span-1 md:col-span-2 xl:col-span-3" } as const;

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export default async function LibraryDashboard() {
  const viewer = await libraryViewer();
  const space = viewer.librarySpace;
  const canEdit = canAddBooks(viewer, space);
  const year = todayIn(viewer.family.timezone).slice(0, 4);
  const [list, cats, saved] = await Promise.all([
    listBooks(viewer, space),
    bookCategoryList(viewer),
    db.select().from(sectionLayouts).where(and(eq(sectionLayouts.memberId, viewer.member.id), eq(sectionLayouts.section, "library"))),
  ]);
  const s = libraryStats(list, cats, year);
  const layout = resolveSectionLayout("library", saved[0]?.widgets);
  const recent = [...list].sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 6);
  const completed = list.filter((b) => b.status === "completed").sort((a, b) => (b.finishedOn ?? "").localeCompare(a.finishedOn ?? "")).slice(0, 6);

  const header = (
    <PageHeader help="library"
      eyebrow="Personal"
      title={space === "mine" ? "My Library" : "Book Library"}
      description={space === "mine" ? "Your own books, reading list and progress. Private to you." : "Every book in the house: what you own, what you're reading and what's next."}
      actions={
        <>
          {list.length > 0 && <DashboardCustomizer layout={layout} titles={sectionTitles("library")} section="library" label="library dashboard" />}
          {canEdit && (
            <>
              <ButtonLink href="/library/scan" variant="secondary" icon={<ScanBarcode className="size-4" />}>
                Scan Barcode
              </ButtonLink>
              <ButtonLink href="/library/add" icon={<Plus className="size-4" />}>
                Add Book
              </ButtonLink>
            </>
          )}
        </>
      }
    />
  );

  if (!list.length) {
    return (
      <>
        {header}
        <LibraryTabs active="dashboard" canEdit={canEdit} space={space} />
        <Card>
          <EmptyState
            icon={<LibraryBig />}
            title="Your library is empty."
            description="Scan a book's barcode to fill in the details automatically, or add one by hand."
            action={
              canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/library/add" icon={<Plus className="size-4" />}>
                    Add Book
                  </ButtonLink>
                  <ButtonLink href="/library/scan" variant="secondary" icon={<ScanBarcode className="size-4" />}>
                    Scan Barcode
                  </ButtonLink>
                </div>
              )
            }
          />
        </Card>
      </>
    );
  }

  const stat = (label: string, value: ReactNode, icon: ReactNode, href?: string) => {
    const body = (
      <>
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">{icon}</span>
        <span>
          <span className="block font-display text-2xl leading-none font-semibold">{value}</span>
          <span className="text-sm text-muted">{label}</span>
        </span>
      </>
    );
    return href ? (
      <Link href={href} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300">
        {body}
      </Link>
    ) : (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">{body}</div>
    );
  };

  const cards: Record<string, ReactNode> = {
    stats: (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("Books", s.total, <LibraryBig className="size-5" />, "/library/books")}
        {stat("Reading now", s.reading.length, <BookOpen className="size-5" />, "/library/books?status=reading")}
        {stat("Completed", s.completed, <CheckCircle2 className="size-5" />, "/library/books?status=completed")}
        {stat("To read", s.toRead.length, <BookMarked className="size-5" />, "/library/books?status=to_read")}
      </div>
    ),
    reading: (
      <Card>
        <CardHeader title="Currently reading" icon={<BookOpen className="size-4" />} href="/library/books?status=reading" />
        {s.reading.length ? (
          <ul className="flex flex-col gap-4">
            {s.reading.slice(0, 4).map((b) => {
              const pct = percentRead(b);
              return (
                <li key={b.id}>
                  <Link href={`/library/books/${b.id}`} className="flex items-center gap-4 hover:text-primary-700">
                    <div className="w-12 shrink-0">
                      <BookCover title={b.title} coverFileId={b.coverFileId} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{b.title}</p>
                      <p className="truncate text-sm text-muted">{b.author}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar value={pct} label={`${b.title}: ${pct}% read`} />
                        <span className="shrink-0 text-xs text-muted tabular-nums">{b.pageCount ? `p. ${b.currentPage ?? 0}/${b.pageCount}` : `${pct}%`}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Quiet>Nothing on the go. Open a book and tap &ldquo;Start reading&rdquo; to track your progress.</Quiet>
        )}
      </Card>
    ),
    yearStats: (
      <Card>
        <CardHeader title={`Reading in ${year}`} icon={<TrendingUp className="size-4" />} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-display text-3xl font-semibold">{s.booksThisYear}</p>
            <p className="text-sm text-muted">books read</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold">{s.pagesThisYear.toLocaleString()}</p>
            <p className="text-sm text-muted">pages read</p>
          </div>
        </div>
        {(s.favoriteCategories.length > 0 || s.favoriteAuthors.length > 0) && (
          <dl className="mt-4 grid gap-2 text-sm">
            {s.favoriteCategories.length > 0 && (
              <div>
                <dt className="text-muted">Favorite categories</dt>
                <dd className="font-medium">{s.favoriteCategories.slice(0, 3).map(([n]) => n).join(", ")}</dd>
              </div>
            )}
            {s.favoriteAuthors.length > 0 && (
              <div>
                <dt className="text-muted">Favorite authors</dt>
                <dd className="font-medium">{s.favoriteAuthors.slice(0, 3).map(([n]) => n).join(", ")}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>
    ),
    toRead: (
      <Card>
        <CardHeader title="To read" icon={<BookMarked className="size-4" />} href="/library/books?status=to_read" />
        {s.toRead.length ? <BookGrid books={s.toRead.slice(0, 3)} compact /> : <Quiet>Mark books &ldquo;Want to Read&rdquo; to build your reading list.</Quiet>}
      </Card>
    ),
    favorites: (
      <Card>
        <CardHeader title="Favorites" icon={<Heart className="size-4" />} href="/library/books?favorite=1" />
        {s.favorites.length ? <BookGrid books={s.favorites.slice(0, 3)} compact /> : <Quiet>Tap the heart on a book to keep it here.</Quiet>}
      </Card>
    ),
    completed: (
      <Card>
        <CardHeader title="Recently completed" icon={<CheckCircle2 className="size-4" />} href="/library/books?status=completed" />
        {completed.length ? <BookGrid books={completed.slice(0, 3)} compact /> : <Quiet>Finished books land here.</Quiet>}
      </Card>
    ),
    recent: (
      <Card>
        <CardHeader title="Recently added" icon={<Clock className="size-4" />} href="/library/books?sort=recent" />
        <BookGrid books={recent} compact />
      </Card>
    ),
    categories: (
      <Card>
        <CardHeader title="Categories" icon={<Tags className="size-4" />} href="/library/categories" hrefLabel="Manage" />
        {s.categoryCounts.length ? (
          <ul className="flex flex-wrap gap-2">
            {s.categoryCounts.map((c) => (
              <li key={c.id}>
                <Link href={`/library/books?category=${c.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm hover:border-primary-300">
                  {c.name} <span className="text-muted tabular-nums">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Quiet>
            No categories yet. <Link href="/library/categories" className="text-primary-700 underline">Create some</Link> to organise your shelves.
          </Quiet>
        )}
      </Card>
    ),
    authors: (
      <Card>
        <CardHeader title="Authors" icon={<PenLine className="size-4" />} href="/library/books?view=author" />
        {s.authors.length ? (
          <ul className="divide-y divide-line">
            {s.authors.slice(0, 6).map(([name, n]) => (
              <li key={name}>
                <Link href={`/library/books?view=author&q=${encodeURIComponent(name)}`} className="flex justify-between gap-3 py-2 text-sm hover:text-primary-700">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted tabular-nums">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Quiet>Add authors to your books to see them here.</Quiet>
        )}
      </Card>
    ),
  };

  return (
    <>
      {header}
      <LibraryTabs active="dashboard" canEdit={canEdit} space={space} />
      <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6 [&>*]:min-w-0">
        {layout
          .filter((w) => w.visible)
          .map((w) => (
            <div key={w.id} className={cn(SPAN[w.size])}>
              {cards[w.id]}
            </div>
          ))}
      </div>
    </>
  );
}
