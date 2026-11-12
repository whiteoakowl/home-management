import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, NotebookPen, Search, Users } from "lucide-react";
import { JournalFormModal } from "@/components/journal/journal-form";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { LinkTabs } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { addDays, addMonths, formatLongDate, monthLabel, startOfMonth, startOfWeek, todayIn } from "@/lib/dates";
import { journalTags, listEntries, moodOf } from "@/lib/journal";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal" };

type Entry = Awaited<ReturnType<typeof listEntries>>[number];

function EntryCard({ x }: { x: Entry }) {
  const mood = moodOf(x.e.mood);
  return (
    <Link href={`/journal/${x.e.id}`} className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary-300 sm:p-6">
      <div className="flex items-center gap-3 text-sm text-muted">
        <Avatar name={x.author} color={x.authorColor} size="xs" />
        <span>{x.author}</span>
        <span>·</span>
        <span>{formatLongDate(x.e.date)}</span>
        {mood && <span title={mood.label}>{mood.emoji}</span>}
        <span className="ml-auto">
          {x.e.visibility === "private" && <Lock className="size-3.5" aria-label="Private" />}
          {x.e.visibility === "selected" && <Users className="size-3.5" aria-label="Shared with selected people" />}
        </span>
      </div>
      {x.e.title && <h2 className="text-2xl leading-snug font-semibold group-hover:text-primary-700">{x.e.title}</h2>}
      <p className="line-clamp-4 font-display text-[17px] leading-relaxed whitespace-pre-line text-ink-soft">{x.e.body}</p>
      {x.photos.length > 0 && (
        <div className="flex gap-2">
          {x.photos.slice(0, 4).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.thumb} alt="" className="size-20 rounded-xl object-cover" />
          ))}
        </div>
      )}
      {x.e.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {x.e.tags.map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
        </div>
      )}
    </Link>
  );
}

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const viewer = await getViewer();
  if (!viewer.can("journal")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const view = ["today", "timeline", "calendar", "search"].includes(String(sp.view)) ? String(sp.view) : "today";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.month) ? sp.month : startOfMonth(today);
  const [members, tags] = await Promise.all([memberOptions(viewer), journalTags(viewer)]);

  const entries =
    view === "today"
      ? await listEntries(viewer, { from: addDays(today, -6), to: today })
      : view === "calendar"
        ? await listEntries(viewer, { from: startOfWeek(month), to: addDays(startOfWeek(month), 41) })
        : view === "search"
          ? q || tag
            ? await listEntries(viewer, { q: q || undefined, tag: tag || undefined })
            : []
          : await listEntries(viewer);
  const canEdit = viewer.can("journal", "edit");
  const add = <JournalFormModal members={members} today={today} defaultOpen={sp.new === "1"} />;
  const mine = entries.filter((x) => x.e.date === today && x.e.authorMemberId === viewer.member.id);

  return (
    <>
      <PageHeader title="Journal" description="Private moments and shared family memories." actions={canEdit ? add : undefined} />
      <LinkTabs
        active={view}
        tabs={[
          { key: "today", href: "/journal", label: "Today" },
          { key: "timeline", href: "/journal?view=timeline", label: "Timeline" },
          { key: "calendar", href: "/journal?view=calendar", label: "Calendar" },
          { key: "search", href: "/journal?view=search", label: "Search" },
        ]}
      />

      {view === "today" && (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <Card className="bg-gradient-to-br from-primary-50 via-surface to-olive-50">
            <p className="text-sm font-medium text-primary-600">{formatLongDate(today)}</p>
            <h2 className="mt-1 text-2xl font-semibold">{mine.length ? "You've written today ✨" : "What's worth remembering today?"}</h2>
            <p className="mt-1 text-[15px] text-muted">Your entries are private unless you choose to share them.</p>
            {canEdit && <div className="mt-4">{<JournalFormModal members={members} today={today} triggerLabel={mine.length ? "Add another entry" : "Write today's entry"} />}</div>}
          </Card>
          {entries.length === 0 ? (
            <Card>
              <EmptyState icon={<NotebookPen />} title="No entries this week" description="A few lines a day adds up to a beautiful family history." example="“Jack lost his first tooth at dinner. He's saving it for the tooth fairy.”" />
            </Card>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted">This week</p>
              {entries.map((x) => (
                <EntryCard key={x.e.id} x={x} />
              ))}
            </>
          )}
        </div>
      )}

      {view === "timeline" && (
        <div className="mx-auto max-w-3xl">
          {entries.length === 0 ? (
            <Card>
              <EmptyState icon={<NotebookPen />} title="Your journal is empty" description="Start writing and your entries will appear here as a timeline." action={canEdit ? <JournalFormModal members={members} today={today} /> : undefined} />
            </Card>
          ) : (
            [...Map.groupBy(entries, (x) => x.e.date.slice(0, 7)).entries()].map(([m, list]) => (
              <section key={m} className="mb-8">
                <h2 className="sticky top-16 z-10 mb-3 bg-canvas/90 py-2 text-xl font-semibold backdrop-blur">{monthLabel(`${m}-01`)}</h2>
                <div className="flex flex-col gap-4">
                  {list.map((x) => (
                    <EntryCard key={x.e.id} x={x} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {view === "calendar" && (
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center gap-2">
            <Link href={`/journal?view=calendar&month=${addMonths(month, -1)}`} aria-label="Previous month" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={`/journal?view=calendar&month=${addMonths(month, 1)}`} aria-label="Next month" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
              <ChevronRight className="size-5" />
            </Link>
            <h2 className="ml-2 text-xl font-semibold">{monthLabel(month)}</h2>
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-b border-line bg-sunken/50 py-2 text-center text-xs font-semibold text-muted uppercase">
                {d}
              </div>
            ))}
            {Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(month), i)).map((d) => {
              const day = entries.filter((x) => x.e.date === d);
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              return (
                <div key={d} className={cn("min-h-20 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-sunken/40")}>
                  <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-sm", d === today ? "bg-primary-600 font-semibold text-white" : inMonth ? "" : "text-muted")}>{Number(d.slice(8))}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {day.map((x) => (
                      <Link key={x.e.id} href={`/journal/${x.e.id}`} title={x.e.title ?? x.e.body.slice(0, 60)} className="flex size-7 items-center justify-center rounded-full bg-primary-50 text-base hover:bg-primary-100">
                        {moodOf(x.e.mood)?.emoji ?? "📝"}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "search" && (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <form action="/journal" className="relative">
            <input type="hidden" name="view" value="search" />
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="jq" className="sr-only">
              Search journal
            </label>
            <input id="jq" name="q" defaultValue={q} autoFocus placeholder="Search your journal…" className="h-12 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pr-3 pl-10 text-[16px] focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none" />
          </form>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Link key={t.tag} href={`/journal?view=search&tag=${encodeURIComponent(t.tag)}`} className={cn("rounded-full px-3 py-1 text-sm", tag === t.tag ? "bg-primary-600 text-white" : "bg-sunken text-ink-soft hover:bg-line")}>
                  #{t.tag} <span className="opacity-60">{t.n}</span>
                </Link>
              ))}
            </div>
          )}
          {(q || tag) && entries.length === 0 && <p className="text-muted">No entries match.</p>}
          {entries.map((x) => (
            <EntryCard key={x.e.id} x={x} />
          ))}
        </div>
      )}
    </>
  );
}
