import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookMarked, BookOpen, CheckCircle2, Heart, Pause, Pencil, Play, Trash2, XCircle } from "lucide-react";
import { deleteBook, logReading, removeReadingEntry, saveReadingEntry, toggleBookFavorite } from "@/app/actions/library";
import { ActionForm } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, NumberField, SelectField, TextAreaField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { BookCover, Stars } from "@/components/library/book-cover";
import { fmtDate } from "@/components/records/detail-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProgressBar } from "@/components/ui/display";
import { publishedYear } from "@/lib/isbn";
import { bookCategoryList, canChangeBook, canChangeEntry, getBook, readingLog } from "@/lib/library";
import { formatLabel, percentRead, READING_STATUSES, STATUS_TONE, statusLabel } from "@/lib/library-config";
import { memberOptions } from "@/lib/queries";
import { libraryViewer } from "../../shared";

export const metadata: Metadata = { title: "Book" };

const primaryBtn = "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700";
const plainBtn = "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm font-medium hover:bg-sunken";
const quietBtn = "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-sm font-medium text-muted hover:bg-sunken";

export default async function BookPage({ params }: PageProps<"/library/books/[id]">) {
  const viewer = await libraryViewer();
  const { id } = await params;
  const b = await getBook(viewer, id);
  if (!b) notFound();
  const canEdit = canChangeBook(viewer, b);
  const [cats, members] = await Promise.all([bookCategoryList(viewer), memberOptions(viewer)]);
  const [entries] = await Promise.all([readingLog(viewer, { bookId: b.id })]);
  const mine = entries.find((x) => x.entry.memberId === viewer.member.id)?.entry ?? null;
  const readers = entries.filter((x) => x.entry.memberId !== viewer.member.id);
  const pct = percentRead(mine, b.pageCount);
  const canLog = viewer.premium;
  const others = members.filter((m) => m.id !== viewer.member.id && !entries.some((x) => x.entry.memberId === m.id));
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
      ["Visibility", b.ownerMemberId ? "My Library (only you)" : b.visibility === "family" ? "Whole family" : b.visibility === "private" ? "Only me" : b.visibility === "parents" ? "Parents & me" : "Shared with selected people"],
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
              {mine && <Badge tone={STATUS_TONE[mine.status] ?? "neutral"}>{statusLabel(mine.status)}</Badge>}
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
            <CardHeader title="Reading log" icon={<BookOpen className="size-4" />} href="/library/reading" hrefLabel="My reading log" />
            {mine ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[mine.status] ?? "neutral"}>{statusLabel(mine.status)}</Badge>
                  <span className="text-sm text-muted">{mine.shared ? "Shared with your family" : "Only you can see this"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={pct} label={`${pct}% read`} tone={mine.status === "completed" ? "olive" : "primary"} />
                  <span className="shrink-0 text-sm font-medium tabular-nums">{pct}%</span>
                </div>
                <p className="text-sm text-muted">
                  {b.pageCount ? `Page ${mine.status === "completed" ? b.pageCount : (mine.currentPage ?? 0)} of ${b.pageCount}` : "Add the page count to the book to track progress by page."}
                  {mine.startedOn && ` · Started ${fmtDate(mine.startedOn)}`}
                  {mine.finishedOn && ` · ${mine.status === "abandoned" ? "Stopped" : "Finished"} ${fmtDate(mine.finishedOn)}`}
                </p>
                {canLog && (
                  <>
                    <div className="rounded-2xl bg-sunken/60 p-3">
                      <ActionForm action={saveReadingEntry} submitLabel="Save" resetOnSuccess={false} showSuccess>
                        <input type="hidden" name="id" value={mine.id} />
                        <input type="hidden" name="sharedField" value="1" />
                        <FormRow>
                          <SelectField name="status" label="Status" defaultValue={mine.status} options={[...READING_STATUSES]} />
                          <NumberField name="currentPage" label="Current page" min={0} max={b.pageCount ?? undefined} defaultValue={mine.currentPage ?? ""} />
                        </FormRow>
                        <FormRow>
                          <DateField name="startedOn" label="Started" defaultValue={mine.startedOn ?? ""} />
                          <DateField name="finishedOn" label="Finished" defaultValue={mine.finishedOn ?? ""} />
                        </FormRow>
                        <TextAreaField name="notes" label="Reading notes" rows={2} defaultValue={mine.notes ?? ""} />
                        <CheckboxField name="shared" label="Share with my family" description="Shows on your profile and the family's reading log." defaultChecked={mine.shared} />
                      </ActionForm>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mine.status !== "reading" && mine.status !== "completed" && (
                        <ActionButton action={logReading} fields={{ bookId: b.id, intent: "start" }} className={primaryBtn}>
                          <Play className="size-4" /> {mine.status === "paused" ? "Resume reading" : "Start reading"}
                        </ActionButton>
                      )}
                      {mine.status === "reading" && (
                        <ActionButton action={logReading} fields={{ bookId: b.id, intent: "pause" }} className={plainBtn}>
                          <Pause className="size-4" /> Pause
                        </ActionButton>
                      )}
                      {mine.status !== "completed" && (
                        <ActionButton action={logReading} fields={{ bookId: b.id, intent: "complete" }} className={plainBtn}>
                          <CheckCircle2 className="size-4" /> Finished
                        </ActionButton>
                      )}
                      {(mine.status === "reading" || mine.status === "paused") && (
                        <ActionButton action={logReading} fields={{ bookId: b.id, intent: "abandon" }} confirm="Stop reading this book?" className={quietBtn}>
                          <XCircle className="size-4" /> Stop reading
                        </ActionButton>
                      )}
                      {mine.status === "completed" && (
                        <ActionButton action={logReading} fields={{ bookId: b.id, intent: "again" }} className={plainBtn}>
                          <Play className="size-4" /> Read again
                        </ActionButton>
                      )}
                      <ActionButton action={removeReadingEntry} fields={{ id: mine.id }} confirm="Take this book out of your reading log? The book stays in the library." className={quietBtn}>
                        <Trash2 className="size-4" /> Remove from my log
                      </ActionButton>
                    </div>
                  </>
                )}
              </div>
            ) : canLog ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">This book isn&apos;t in your reading log. Add it when you start reading, or save it for later.</p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={logReading} fields={{ bookId: b.id, intent: "start" }} className={primaryBtn}>
                    <BookOpen className="size-4" /> I&apos;m reading this
                  </ActionButton>
                  <ActionButton action={logReading} fields={{ bookId: b.id, intent: "want" }} className={plainBtn}>
                    <BookMarked className="size-4" /> Want to read
                  </ActionButton>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">The reading log is part of Premium.</p>
            )}

            {canLog && viewer.isParent && !b.ownerMemberId && others.length > 0 && (
              <details className="mt-4 rounded-2xl border border-line p-3">
                <summary className="cursor-pointer text-sm font-medium">Log it for someone else</summary>
                <form action={logReading} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="bookId" value={b.id} />
                  <input type="hidden" name="intent" value="start" />
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-ink-soft">Who&apos;s reading</span>
                    <select name="memberId" className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3">
                      {others.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className={plainBtn}>
                    Add to their log
                  </button>
                </form>
              </details>
            )}

            {readers.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="mb-2 text-sm font-semibold">Who&apos;s reading it</h3>
                <ul className="flex flex-col gap-2">
                  {readers.map(({ entry: e, reader: r }) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: r.color }} aria-hidden />
                      <Link href={`/library/reading?member=${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>{statusLabel(e.status)}</Badge>
                      {e.status === "reading" && <span className="text-muted tabular-nums">{percentRead(e, b.pageCount)}%</span>}
                      {!e.shared && <span className="text-xs text-muted">(not shared)</span>}
                      {canChangeEntry(viewer, e) && e.memberId !== viewer.member.id && (
                        <ActionButton action={removeReadingEntry} fields={{ id: e.id }} confirm={`Take this book out of ${r.name}'s reading log?`} className="ml-auto text-xs text-muted hover:text-ink" label={`Remove from ${r.name}'s log`}>
                          Remove
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
