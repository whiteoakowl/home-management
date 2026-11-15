import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, Heart, Pause, Pencil, Play, XCircle } from "lucide-react";
import { deleteBook, setReadingStatus, toggleBookFavorite, updateReading } from "@/app/actions/library";
import { ActionForm } from "@/components/forms/action-form";
import { NumberField, TextAreaField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { BookCover, Stars } from "@/components/library/book-cover";
import { fmtDate } from "@/components/records/detail-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProgressBar } from "@/components/ui/display";
import { publishedYear } from "@/lib/isbn";
import { bookCategoryList, getBook } from "@/lib/library";
import { formatLabel, percentRead, STATUS_TONE, statusLabel } from "@/lib/library-config";
import { memberOptions } from "@/lib/queries";
import { libraryViewer } from "../../shared";

export const metadata: Metadata = { title: "Book" };

export default async function BookPage({ params }: PageProps<"/library/books/[id]">) {
  const viewer = await libraryViewer();
  const { id } = await params;
  const b = await getBook(viewer, id);
  if (!b) notFound();
  const canEdit = viewer.can("library", "edit");
  const [cats, members] = await Promise.all([bookCategoryList(viewer), memberOptions(viewer)]);
  const pct = percentRead(b);
  const reader = members.find((m) => m.id === b.readerMemberId);
  const bookCats = cats.filter((c) => b.categoryIds.includes(c.id));
  const meta: [string, React.ReactNode][] = (
    [
      ["Co-author", b.coAuthor],
      ["ISBN", b.isbn],
      ["Publisher", b.publisher],
      ["Published", b.publishedDate],
      ["Edition", b.edition],
      ["Format", formatLabel(b.format)],
      ["Pages", b.pageCount?.toLocaleString()],
      ["Genre", b.genre],
      ["Acquired", b.acquiredOn ? fmtDate(b.acquiredOn) : null],
      ["From", b.purchaseLocation],
      ["Price", b.priceCents != null ? `$${(b.priceCents / 100).toFixed(2)}` : null],
      ["Reader", reader?.displayName],
      ["Visibility", b.visibility === "family" ? "Whole family" : b.visibility === "private" ? "Private" : "Shared with selected people"],
    ] as [string, React.ReactNode][]
  ).filter(([, v]) => v);

  return (
    <>
      <Link href="/library/books" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All books
      </Link>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-10">
        <div className="mx-auto w-44 sm:w-56 lg:w-full">
          <BookCover title={b.title} author={b.author} coverFileId={b.coverFileId} large />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{statusLabel(b.status)}</Badge>
              {bookCats.map((c) => (
                <Link key={c.id} href={`/library/books?category=${c.id}`}>
                  <Badge tone="primary">{c.name}</Badge>
                </Link>
              ))}
            </div>
            <h1 className="text-[28px] leading-tight font-semibold sm:text-[34px]">{b.title}</h1>
            {b.subtitle && <p className="text-lg text-ink-soft">{b.subtitle}</p>}
            {b.author && (
              <p className="text-[15px] text-muted">
                by{" "}
                <Link href={`/library/books?view=author&q=${encodeURIComponent(b.author)}`} className="font-medium text-ink hover:underline">
                  {b.author}
                </Link>
                {publishedYear(b.publishedDate) && <> · {publishedYear(b.publishedDate)}</>}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Stars value={b.rating} className="text-lg" />
            </div>
            {canEdit && (
              <div className="mt-1 flex flex-wrap gap-2">
                <ButtonLink href={`/library/books/${b.id}/edit`} variant="secondary" size="sm" icon={<Pencil className="size-4" />}>
                  Edit
                </ButtonLink>
                <ActionButton action={toggleBookFavorite} fields={{ id: b.id }} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm font-medium hover:bg-sunken" label={b.isFavorite ? "Remove from favorites" : "Add to favorites"}>
                  <Heart className={b.isFavorite ? "size-4 fill-wine-500 text-wine-500" : "size-4"} /> {b.isFavorite ? "Favorite" : "Add to favorites"}
                </ActionButton>
                <DeleteButton action={deleteBook} fields={{ id: b.id }} what={`"${b.title}"`} />
              </div>
            )}
          </header>

          <Card>
            <CardHeader title="Reading" icon={<BookOpen className="size-4" />} />
            <div className="flex items-center gap-3">
              <ProgressBar value={pct} label={`${pct}% read`} tone={b.status === "completed" ? "olive" : "primary"} />
              <span className="shrink-0 text-sm font-medium tabular-nums">{pct}%</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              {b.pageCount ? `Page ${b.status === "completed" ? b.pageCount : (b.currentPage ?? 0)} of ${b.pageCount}` : "Add the page count to track progress by page."}
              {b.startedOn && ` · Started ${fmtDate(b.startedOn)}`}
              {b.finishedOn && ` · ${b.status === "abandoned" ? "Stopped" : "Finished"} ${fmtDate(b.finishedOn)}`}
            </p>
            {canEdit && (
              <>
                {b.status !== "completed" && (
                  <div className="mt-4 rounded-2xl bg-sunken/60 p-3">
                    <ActionForm action={updateReading} submitLabel="Update progress" resetOnSuccess={false} showSuccess>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="intent" value="progress" />
                      <NumberField name="currentPage" label="Current page" min={0} max={b.pageCount ?? undefined} defaultValue={b.currentPage ?? ""} />
                      <TextAreaField name="readingNotes" label="Reading notes" rows={2} defaultValue={b.readingNotes ?? ""} />
                    </ActionForm>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status !== "reading" && b.status !== "completed" && (
                    <ActionButton action={setReadingStatus} fields={{ id: b.id, intent: "start" }} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700">
                      <Play className="size-4" /> {b.status === "paused" ? "Resume reading" : "Start reading"}
                    </ActionButton>
                  )}
                  {b.status === "reading" && (
                    <ActionButton action={setReadingStatus} fields={{ id: b.id, intent: "pause" }} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
                      <Pause className="size-4" /> Pause
                    </ActionButton>
                  )}
                  {b.status !== "completed" && (
                    <ActionButton action={setReadingStatus} fields={{ id: b.id, intent: "complete" }} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
                      <CheckCircle2 className="size-4" /> Mark completed
                    </ActionButton>
                  )}
                  {(b.status === "reading" || b.status === "paused") && (
                    <ActionButton action={setReadingStatus} fields={{ id: b.id, intent: "abandon" }} confirm="Stop reading this book?" className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-sm font-medium text-muted hover:bg-sunken">
                      <XCircle className="size-4" /> Abandon
                    </ActionButton>
                  )}
                  {b.status === "completed" && (
                    <ActionButton action={setReadingStatus} fields={{ id: b.id, intent: "start" }} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
                      <Play className="size-4" /> Read again
                    </ActionButton>
                  )}
                </div>
              </>
            )}
            {!canEdit && b.readingNotes && <p className="mt-3 text-sm whitespace-pre-line">{b.readingNotes}</p>}
          </Card>

          {b.description && (
            <section>
              <h2 className="mb-2 font-sans text-base font-semibold">About this book</h2>
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{b.description}</p>
            </section>
          )}

          {meta.length > 0 && (
            <dl className="grid gap-x-6 gap-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
              {meta.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</dt>
                  <dd className="truncate text-[15px]">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {b.notes && (
            <section>
              <h2 className="mb-2 font-sans text-base font-semibold">Notes</h2>
              <p className="text-[15px] whitespace-pre-line text-ink-soft">{b.notes}</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
