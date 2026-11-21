import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, sql } from "drizzle-orm";
import { Images, Lock, MapPin, Plane, Search, Sparkles, Star } from "lucide-react";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { MemoryModal } from "@/components/memories/memory-form";
import { MediaTile } from "@/components/memories/media";
import { MemoriesTabs } from "@/components/memories/tabs";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { memoryVisible, timeline, timelineYears, type TimelineItem } from "@/lib/memories";
import { familyMembersFor } from "@/lib/names";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Memories" };

const monthName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default async function MemoriesPage({ searchParams }: PageProps<"/memories">) {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const sp = await searchParams;
  const canUse = viewer.can("photos", "use");
  const today = todayIn(viewer.family.timezone);
  const years = await timelineYears(viewer);
  const year = Number(sp.year) && years.includes(Number(sp.year)) ? Number(sp.year) : undefined;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const milestones = sp.milestones === "1";
  const [opts, people] = await Promise.all([memberOptions(viewer), familyMembersFor(viewer)]);
  const memberId = typeof sp.member === "string" && people.some((p) => p.id === sp.member) ? sp.member : undefined;
  const [items, onThisDay] = await Promise.all([
    timeline(viewer, { year, q, memberId, milestones }),
    db
      .select({ id: memories.id, title: memories.title, date: memories.date })
      .from(memories)
      .where(and(memoryVisible(viewer), sql`to_char(${memories.date}, 'MM-DD') = ${today.slice(5)}`, sql`${memories.date} < ${today}`))
      .limit(5),
  ]);
  const href = (o: { year?: number | null; member?: string | null; milestones?: boolean }) => {
    const p = new URLSearchParams();
    const y = o.year === undefined ? year : o.year;
    const m = o.member === undefined ? memberId : o.member;
    if (y) p.set("year", String(y));
    if (m) p.set("member", m);
    if (o.milestones ?? milestones) p.set("milestones", "1");
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/memories?${s}` : "/memories";
  };
  const groups = new Map<string, TimelineItem[]>();
  for (const it of items) {
    const k = it.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const person = (id: string) => people.find((p) => p.id === id);

  return (
    <>
      <PageHeader
        eyebrow="Family"
        title="Memories"
        description="Your family's story: big moments, everyday memories, photos and videos, year by year."
        actions={
          canUse ? (
            <>
              <MemoryModal members={opts} today={today} milestone />
              <MemoryModal members={opts} today={today} />
            </>
          ) : undefined
        }
      />
      <MemoriesTabs active={milestones ? "milestones" : "timeline"} />

      <form action="/memories" className="mb-4 flex flex-wrap items-center gap-2" role="search">
        {year && <input type="hidden" name="year" value={year} />}
        {milestones && <input type="hidden" name="milestones" value="1" />}
        {memberId && <input type="hidden" name="member" value={memberId} />}
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Search memories, albums and trips" aria-label="Search memories" className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-[15px]" />
        </label>
      </form>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {years.length > 0 && <SegmentLinks active={year ? String(year) : "all"} items={[{ key: "all", href: href({ year: null }), label: "All years" }, ...years.slice(0, 8).map((y) => ({ key: String(y), href: href({ year: y }), label: String(y) }))]} />}
        <div className="flex items-center gap-1">
          {people.map((p) => (
            <Link key={p.id} href={href({ member: memberId === p.id ? null : p.id })} title={`Memories with ${p.displayName}`} className={cn("rounded-full p-0.5", memberId === p.id ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100")}>
              <Avatar name={p.displayName} color={p.color} photoUrl={fileUrl(p.avatarFileId, true)} size="sm" />
            </Link>
          ))}
        </div>
      </div>

      {onThisDay.length > 0 && !q && !year && (
        <Card className="mb-6 border-primary-200 bg-primary-50/50">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary-600" /> On this day
          </p>
          <ul className="text-sm">
            {onThisDay.map((m) => (
              <li key={m.id}>
                <Link href={`/memories/${m.id}`} className="hover:underline">
                  {Number(today.slice(0, 4)) - Number(m.date.slice(0, 4))} year{Number(today.slice(0, 4)) - Number(m.date.slice(0, 4)) === 1 ? "" : "s"} ago: <span className="font-medium">{m.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles />}
            title={q ? "Nothing found" : milestones ? "No milestones yet" : "Start your family timeline"}
            description={q ? "Try another word." : "Add a memory with photos or videos: first steps, birthdays, road trips, the funny thing someone said at dinner. Albums and trips show up here too."}
            action={canUse && !q ? <MemoryModal members={opts} today={today} milestone={milestones} /> : undefined}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {[...groups.entries()].map(([ym, list], gi) => {
            const newYear = gi === 0 || [...groups.keys()][gi - 1]!.slice(0, 4) !== ym.slice(0, 4);
            return (
              <section key={ym}>
                {newYear && <h2 className="mb-3 font-display text-3xl font-semibold">{ym.slice(0, 4)}</h2>}
                <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{monthName(`${ym}-01`)}</h3>
                <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
                  {list.map((it) => (
                    <li key={`${it.type}:${it.id}`} className="relative">
                      <span className={cn("absolute top-5 -left-[23px] size-3 rounded-full border-2 border-surface", it.type === "memory" && it.milestone ? "bg-[#e0a915]" : it.type === "trip" ? "bg-[#5b7fd6]" : "bg-primary-500")} aria-hidden />
                      {it.type === "memory" && (
                        <Link href={`/memories/${it.id}`} className="block">
                          <Card className="transition hover:border-primary-300">
                            <p className="text-xs text-muted">{dayLabel(it.date)}</p>
                            <p className="flex flex-wrap items-center gap-2 font-semibold">
                              {it.milestone && <Star className="size-4 fill-[#f5c84c] text-[#d9a514]" aria-label="Milestone" />}
                              {it.title}
                              {it.private && (
                                <Badge>
                                  <Lock className="size-3" /> Only me
                                </Badge>
                              )}
                            </p>
                            {it.body && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{it.body}</p>}
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                              {it.place && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3" /> {it.place}
                                </span>
                              )}
                              {it.memberIds.map((id) => person(id)?.displayName.split(" ")[0]).filter(Boolean).join(", ")}
                            </p>
                            {it.media.length > 0 && (
                              <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                                {it.media.slice(0, 6).map((m, i) => (
                                  <span key={m.fileId} className="relative block aspect-square overflow-hidden rounded-lg bg-sunken">
                                    <MediaTile fileId={m.fileId} mediaType={m.mediaType} alt="" />
                                    {i === 5 && it.media.length > 6 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 font-semibold text-white">+{it.media.length - 6}</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </Card>
                        </Link>
                      )}
                      {it.type === "photo" && (
                        <Link href={`/photos/${it.albumId}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 hover:border-primary-300">
                          <span className="size-16 shrink-0 overflow-hidden rounded-lg">
                            <MediaTile fileId={it.fileId} mediaType={it.mediaType} alt="" />
                          </span>
                          <span>
                            <span className="block text-xs text-muted">{dayLabel(it.date)}</span>
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Star className="size-4 fill-[#f5c84c] text-[#d9a514]" /> {it.title}
                            </span>
                          </span>
                        </Link>
                      )}
                      {it.type === "album" && (
                        <Link href={`/photos/${it.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 hover:border-primary-300">
                          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken">
                            {it.cover ? <MediaTile fileId={it.cover} mediaType="photo" alt="" /> : <Images className="size-6 text-muted" />}
                          </span>
                          <span>
                            <span className="block text-xs text-muted">Album · {dayLabel(it.date)}</span>
                            <span className="block font-semibold">{it.title}</span>
                            <span className="text-sm text-muted">
                              {it.count} photo{it.count === 1 ? "" : "s"}
                            </span>
                          </span>
                        </Link>
                      )}
                      {it.type === "trip" && (
                        <Link href={`/plans/${it.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 hover:border-primary-300">
                          <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-[#eaf0fd] text-[#3c5fb0]">
                            <Plane className="size-6" />
                          </span>
                          <span>
                            <span className="block text-xs text-muted">
                              Trip · {dayLabel(it.date)}
                              {it.endDate && it.endDate !== it.date ? ` – ${dayLabel(it.endDate)}` : ""}
                            </span>
                            <span className="block font-semibold">{it.title}</span>
                            {it.destination && <span className="text-sm text-muted">{it.destination}</span>}
                          </span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
