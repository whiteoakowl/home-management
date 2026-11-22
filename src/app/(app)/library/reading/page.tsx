import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Eye, EyeOff, LibraryBig } from "lucide-react";
import { toggleReadingShared } from "@/app/actions/library";
import { ActionButton } from "@/components/forms/inline";
import { BookCover } from "@/components/library/book-cover";
import { LibraryTabs } from "@/components/library/library-tabs";
import { fmtDate } from "@/components/records/detail-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { canAddBooks, canChangeEntry, readingLog, type ReadingLogRow } from "@/lib/library";
import { percentRead, READING_STATUSES, STATUS_TONE, statusLabel } from "@/lib/library-config";
import { listFamilyMembers } from "@/lib/dal";
import { libraryViewer } from "../shared";

export const metadata: Metadata = { title: "Reading log" };

/** One reading-log line: cover, title, who, status, progress, dates. */
function Entry({ row, showReader, canShare }: { row: ReadingLogRow; showReader?: boolean; canShare?: boolean }) {
  const { entry: e, book: b, reader: r } = row;
  const pct = percentRead(e, b.pageCount);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pr-3">
      <Link href={`/library/books/${b.id}`} className="w-11 shrink-0" aria-hidden tabIndex={-1}>
        <BookCover title={b.title} coverFileId={b.coverFileId} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/library/books/${b.id}`} className="block truncate font-semibold hover:text-primary-700">
          {b.title}
        </Link>
        <p className="truncate text-sm text-muted">
          {showReader ? (
            <>
              <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: r.color }} aria-hidden />
              {r.name}
            </>
          ) : (
            (b.author ?? "Unknown author")
          )}
          {e.startedOn && e.status !== "want_to_read" && ` · started ${fmtDate(e.startedOn)}`}
          {e.finishedOn && ` · ${e.status === "abandoned" ? "stopped" : "finished"} ${fmtDate(e.finishedOn)}`}
        </p>
        {(e.status === "reading" || e.status === "paused") && (
          <div className="mt-1.5 flex items-center gap-2">
            <ProgressBar value={pct} label={`${b.title}: ${pct}% read`} />
            <span className="shrink-0 text-xs text-muted tabular-nums">{b.pageCount ? `p. ${e.currentPage ?? 0}/${b.pageCount}` : `${pct}%`}</span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>{statusLabel(e.status)}</Badge>
        {canShare && (
          <ActionButton
            action={toggleReadingShared}
            fields={{ id: e.id }}
            className="inline-flex min-h-9 items-center gap-1 text-xs text-muted hover:text-ink"
            label={e.shared ? "Shared with family. Tap to make it private." : "Private. Tap to share with family."}
          >
            {e.shared ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} {e.shared ? "Shared" : "Private"}
          </ActionButton>
        )}
      </div>
    </li>
  );
}

/**
 * The reading log, separate from the books themselves: what you're reading, want to
 * read and have finished, and what the rest of the family is reading (when shared).
 */
export default async function ReadingLogPage({ searchParams }: PageProps<"/library/reading">) {
  const viewer = await libraryViewer();
  const sp = await searchParams;
  const tab = sp.view === "family" || typeof sp.member === "string" ? "family" : "mine";
  const members = await listFamilyMembers(viewer.family.id);
  const memberId = typeof sp.member === "string" && members.some((m) => m.id === sp.member) ? sp.member : undefined;

  const header = (
    <PageHeader
      help="library"
      eyebrow="Book Library"
      title="Reading log"
      description="What everyone is reading, kept separate from the books themselves. Open any book in the library and tap “I'm reading this” to add it."
      actions={
        <ButtonLink href="/library/books" variant="secondary" icon={<LibraryBig className="size-4" />}>
          Browse the library
        </ButtonLink>
      }
    />
  );
  const tabs = (
    <div className="mb-5">
      <SegmentLinks
        active={tab}
        items={[
          { key: "mine", href: "/library/reading", label: "My reading" },
          { key: "family", href: "/library/reading?view=family", label: "Family" },
        ]}
      />
    </div>
  );

  if (tab === "mine") {
    const rows = await readingLog(viewer, { memberId: viewer.member.id });
    const groups = READING_STATUSES.map((s) => ({ ...s, rows: rows.filter((r) => r.entry.status === s.value) })).filter((g) => g.rows.length);
    return (
      <>
        {header}
        <LibraryTabs active="reading" canEdit={canAddBooks(viewer, viewer.librarySpace)} space={viewer.librarySpace} />
        {tabs}
        {groups.length ? (
          <div className="flex flex-col gap-6">
            {groups.map((g) => (
              <section key={g.value} aria-labelledby={`g-${g.value}`}>
                <h2 id={`g-${g.value}`} className="mb-2 font-sans text-base font-semibold">
                  {g.label} <span className="text-muted tabular-nums">{g.rows.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {g.rows.map((r) => (
                    <Entry key={r.entry.id} row={r} canShare={viewer.premium && canChangeEntry(viewer, r.entry)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<BookOpen />}
              title="Your reading log is empty."
              description="Open a book in the library and tap “I'm reading this” (or “Want to read”). Adding a book to the library doesn't put it in your log."
              action={<ButtonLink href="/library/books">Browse the library</ButtonLink>}
            />
          </Card>
        )}
      </>
    );
  }

  // Family: what each person is reading now (shared entries only, plus your own), or one person's whole shared log.
  const rows = await readingLog(viewer, { memberId, statuses: memberId ? undefined : ["reading", "paused"] });
  const people = members.filter((m) => !memberId || m.id === memberId);
  return (
    <>
      {header}
      <LibraryTabs active="reading" canEdit={canAddBooks(viewer, viewer.librarySpace)} space={viewer.librarySpace} />
      {tabs}
      <nav aria-label="Family members" className="mb-4 flex flex-wrap gap-2">
        <Link href="/library/reading?view=family" aria-current={!memberId ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm ${!memberId ? "border-primary-400 bg-primary-50 text-primary-700" : "border-line hover:bg-sunken"}`}>
          Everyone
        </Link>
        {members.map((m) => (
          <Link key={m.id} href={`/library/reading?member=${m.id}`} aria-current={memberId === m.id ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm ${memberId === m.id ? "border-primary-400 bg-primary-50 text-primary-700" : "border-line hover:bg-sunken"}`}>
            {m.displayName}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-muted">{memberId ? "Everything in their reading log that they've shared with the family." : "What everyone is reading right now. Only books people chose to share are shown."}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {people.map((m) => {
          const theirs = rows.filter((r) => r.entry.memberId === m.id);
          if (!memberId && !theirs.length) return null;
          return (
            <Card key={m.id}>
              <CardHeader title={m.id === viewer.member.id ? `${m.displayName} (you)` : m.displayName} href={memberId ? (viewer.isParent || m.id === viewer.member.id ? `/family/${m.id}` : undefined) : `/library/reading?member=${m.id}`} hrefLabel={memberId ? "Profile" : "Their reading log"} />
              {theirs.length ? (
                <ul className="flex flex-col gap-2">
                  {theirs.map((r) => (
                    <Entry key={r.entry.id} row={r} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nothing shared yet.</p>
              )}
            </Card>
          );
        })}
      </div>
      {!memberId && !rows.length && (
        <Card>
          <EmptyState icon={<BookOpen />} title="No one is sharing a book right now." description="When someone starts reading and shares it with the family, it shows here and on their profile." />
        </Card>
      )}
    </>
  );
}
