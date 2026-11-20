import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { CalendarDays, Check, CheckCheck, ChevronRight, FileText, Megaphone, MessagesSquare, Pin, Search } from "lucide-react";
import { db } from "@/db";
import { calendarEvents, familyMessages, files, messageReactions, messageReads, pollVotes } from "@/db/schema";
import { ChatComposer, ChatLive, MembersButton, MessageTools, NewMenu, PollCard, Reactions } from "@/components/hub/chat";
import { Avatar, EmptyState } from "@/components/ui/display";
import { memberColor } from "@/lib/colors";
import { getViewer, listFamilyMembers } from "@/lib/dal";
import { addDays, formatTime, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { markRead } from "@/lib/hub";
import { canPostChannel, canSeeChannel, CHANNELS, visibleChannels, type Channel } from "@/lib/hub-shared";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Family Chat" };

const dayLabel = (d: Date, tz: string, today: string) => {
  const iso = d.toLocaleDateString("en-CA", { timeZone: tz });
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });
};

/** For "Share an event": family-visible events from yesterday to two weeks ahead. */
function eventsSoon(familyId: string) {
  const now = Date.now();
  return db
    .select({ id: calendarEvents.id, title: calendarEvents.title, startsAt: calendarEvents.startsAt, allDay: calendarEvents.allDay })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.familyId, familyId), eq(calendarEvents.visibility, "family"), gte(calendarEvents.startsAt, new Date(now - 86_400_000)), lte(calendarEvents.startsAt, new Date(now + 14 * 86_400_000))))
    .orderBy(asc(calendarEvents.startsAt))
    .limit(40);
}

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  const viewer = await getViewer();
  if (!viewer.can("messages")) notFound();
  const sp = await searchParams;
  const tz = viewer.family.timezone;
  const today = todayIn(tz);
  const me = viewer.member.id;
  const mineChannels = visibleChannels(viewer.isParent);
  const view = sp.c === "pinned" ? "pinned" : typeof sp.c === "string" && canSeeChannel(viewer.isParent, sp.c) ? (sp.c as Channel) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const where = and(
    eq(familyMessages.familyId, viewer.family.id),
    view === "pinned" ? and(isNotNull(familyMessages.pinnedAt), inArray(familyMessages.channel, mineChannels)) : eq(familyMessages.channel, view),
    q ? ilike(familyMessages.body, `%${q.replace(/[%_]/g, "\\$&")}%`) : undefined,
  );
  const [rows, members, others] = await Promise.all([
    db.select({ m: familyMessages, fileName: files.originalName, fileMime: files.mimeType }).from(familyMessages).leftJoin(files, eq(files.id, familyMessages.fileId)).where(where).orderBy(desc(familyMessages.createdAt)).limit(150),
    listFamilyMembers(viewer.family.id),
    // When did anyone else last open the chat? (for ✓✓ on my messages)
    db.select({ at: messageReads.lastReadAt }).from(messageReads).where(and(eq(messageReads.familyId, viewer.family.id), ne(messageReads.memberId, me))).orderBy(desc(messageReads.lastReadAt)).limit(1),
  ]);
  await markRead(viewer.family.id, me);
  const messages = rows.reverse();
  const ids = messages.map((r) => r.m.id);
  const eventIds = messages.map((r) => r.m.eventId).filter((x): x is string => !!x);
  const [reactions, votes, events, upcoming] = await Promise.all([
    ids.length ? db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids)).orderBy(asc(messageReactions.createdAt)) : [],
    ids.length ? db.select().from(pollVotes).where(inArray(pollVotes.messageId, ids)) : [],
    eventIds.length ? db.select().from(calendarEvents).where(and(inArray(calendarEvents.id, eventIds), eq(calendarEvents.familyId, viewer.family.id))) : [],
    eventsSoon(viewer.family.id),
  ]);

  const byId = new Map(members.map((m) => [m.id, m]));
  const first = (id: string | null) => byId.get(id ?? "")?.displayName.split(" ")[0] ?? "Former member";
  const holder = viewer.family.ownerMemberId;
  const seenUntil = others[0]?.at ?? null;
  const eventWhen = (d: Date, allDay: boolean) => {
    const day = d.toLocaleDateString("en-CA", { timeZone: tz });
    const label = day === today ? "today" : day === addDays(today, 1) ? "tomorrow" : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });
    return allDay ? label : `${label} at ${formatTime(d, tz)}`;
  };
  const audience = view === "parents" ? members.filter((m) => m.role === "parent") : members;
  const canPost = view !== "pinned" && viewer.can("messages", "use") && canPostChannel(viewer.isParent, view);
  const tabs = [...CHANNELS.filter((c) => mineChannels.includes(c.key)), { key: "pinned" as const, label: "Pinned" }];
  const days = messages.map((r) => dayLabel(r.m.createdAt, tz, today));
  const familyPhoto = fileUrl(viewer.family.imageFileId, true);

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <ChatLive latest={messages.at(-1)?.m.id ?? ""} />

      {/* Header */}
      <header className="mb-4 flex items-center gap-3">
        {familyPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={familyPhoto} alt="" className="size-14 shrink-0 rounded-full object-cover ring-2 ring-surface sm:size-16" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 sm:size-16">
            <MessagesSquare className="size-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-semibold sm:text-[30px]">Family Chat</h1>
          <MembersButton count={audience.length} members={audience.map((m) => ({ id: m.id, name: m.displayName, color: m.color, photo: fileUrl(m.avatarFileId, true), holder: m.id === holder }))} />
        </div>
        <details className="group relative">
          <summary aria-label="Search messages" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-ink-soft hover:bg-sunken [&::-webkit-details-marker]:hidden">
            <Search className="size-5" />
          </summary>
          <form action="/messages" className="absolute top-12 right-0 z-30 flex w-72 gap-2 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
            <input type="hidden" name="c" value={view} />
            <input name="q" defaultValue={q} placeholder="Search messages…" aria-label="Search messages" className="h-10 flex-1 rounded-xl border border-line px-3 text-[15px] outline-none focus:border-primary-400" />
          </form>
        </details>
        <NewMenu canPost={canPost} />
      </header>

      {/* Chats */}
      <nav aria-label="Chats" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/messages" : `/messages?c=${t.key}`}
            aria-current={view === t.key ? "page" : undefined}
            className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors", view === t.key ? "bg-primary-100 text-primary-800" : "bg-surface text-ink-soft ring-1 ring-line hover:bg-sunken")}
          >
            {t.key === "announcements" && <Megaphone className="size-4" />}
            {t.key === "pinned" && <Pin className="size-4" />}
            {t.label}
          </Link>
        ))}
      </nav>
      {q && (
        <p className="mb-3 text-sm text-muted">
          Showing messages with “{q}”.{" "}
          <Link href={view === "all" ? "/messages" : `/messages?c=${view}`} className="font-medium text-primary-700 underline">
            Clear search
          </Link>
        </p>
      )}

      {/* Messages */}
      <section className="flex min-h-[40dvh] flex-col rounded-[var(--radius-card)] border border-line bg-surface p-3 sm:p-5">
        {messages.length === 0 ? (
          <EmptyState
            icon={view === "pinned" ? <Pin /> : view === "announcements" ? <Megaphone /> : <MessagesSquare />}
            title={q ? "No messages found" : view === "pinned" ? "Nothing pinned yet" : view === "announcements" ? "No announcements yet" : "Say hello"}
            description={view === "pinned" ? "Pin important messages (tap the smile button on a message) and they'll be collected here." : view === "parents" ? "A private chat just for parents." : view === "kids" ? "A chat for the kids (parents can read it too)." : view === "announcements" ? "Parents post family announcements here; everyone can react." : "Messages here go to everyone in the family."}
          />
        ) : (
          <ol className="flex flex-col gap-4" aria-label="Messages">
            {messages.map(({ m, fileName, fileMime }, i) => {
              const author = byId.get(m.memberId ?? "");
              const mine = m.memberId === me;
              const name = first(m.memberId);
              const rx = reactions.filter((r) => r.messageId === m.id);
              const grouped = [...new Set(rx.map((r) => r.emoji))].map((e) => {
                const who = rx.filter((r) => r.emoji === e);
                return { emoji: e, count: who.length, mine: who.some((r) => r.memberId === me), who: who.map((r) => first(r.memberId)).join(", ") };
              });
              const time = formatTime(m.createdAt, tz);
              const tools = <MessageTools id={m.id} mine={mine} pinned={!!m.pinnedAt} canPin={viewer.isParent || mine} canDelete={viewer.isParent || mine} />;
              const ev = m.kind === "event" ? events.find((e) => e.id === m.eventId) : null;
              const showChannel = view === "pinned" ? CHANNELS.find((c) => c.key === m.channel)?.label : null;

              // Event cards and announcements span the chat.
              if (m.kind === "event" || m.channel === "announcements") {
                const isEvent = m.kind === "event";
                return (
                  <li key={m.id} className="flex flex-col gap-2">
                    {days[i] !== days[i - 1] && <p className="self-center rounded-full bg-sunken px-3 py-0.5 text-xs font-medium text-muted">{days[i]}</p>}
                    <div className="group flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/70 p-4">
                      {isEvent ? <CalendarDays className="mt-0.5 size-7 shrink-0 text-primary-700" /> : <Megaphone className="mt-0.5 size-7 shrink-0 text-primary-700" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-primary-900">{isEvent ? "Event reminder" : "Announcement"}</p>
                          <span className="ml-auto shrink-0 text-xs text-muted">{time}</span>
                          {tools}
                        </div>
                        {isEvent ? (
                          ev ? (
                            <>
                              <p className="text-[15px]">
                                {ev.title} {eventWhen(ev.startsAt, ev.allDay)}
                              </p>
                              {m.body && <p className="mt-0.5 text-sm text-ink-soft">{m.body}</p>}
                              <Link href={`/calendar/event/${ev.id}`} className="mt-1 inline-flex items-center gap-0.5 text-sm font-medium text-primary-700 underline">
                                View details <ChevronRight className="size-4" />
                              </Link>
                            </>
                          ) : (
                            <p className="text-sm text-muted">This event was removed from the calendar.</p>
                          )
                        ) : (
                          <>
                            {m.kind === "poll" && m.poll ? (
                              <PollCard
                                id={m.id}
                                question={m.poll.question}
                                total={votes.filter((v) => v.messageId === m.id).length}
                                options={m.poll.options.map((o) => ({ ...o, count: votes.filter((v) => v.messageId === m.id && v.optionId === o.id).length, mine: votes.some((v) => v.messageId === m.id && v.optionId === o.id && v.memberId === me) }))}
                              />
                            ) : (
                              m.body && <p className="text-[15px] whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
                            )}
                            {m.fileId && m.kind === "photo" && (
                              <a href={fileUrl(m.fileId)!} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={fileUrl(m.fileId, true)!} alt="Shared photo" className="mt-2 max-h-64 rounded-xl object-cover" loading="lazy" />
                              </a>
                            )}
                          </>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          {name}
                          {m.pinnedAt && " · 📌 pinned"}
                        </p>
                        {grouped.length > 0 && (
                          <div className="mt-1.5">
                            <Reactions id={m.id} items={grouped} />
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              }

              const color = memberColor(author?.color);
              return (
                <li key={m.id} className="flex flex-col gap-2">
                  {days[i] !== days[i - 1] && <p className="self-center rounded-full bg-sunken px-3 py-0.5 text-xs font-medium text-muted">{days[i]}</p>}
                  <div className={cn("group flex items-start gap-2.5", mine && "flex-row-reverse")}>
                    {!mine && <Avatar name={author?.displayName ?? "?"} color={author?.color ?? "stone"} photoUrl={fileUrl(author?.avatarFileId, true)} size="md" className="mt-5 shrink-0" />}
                    <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[75%]", mine && "items-end")}>
                      {!mine && (
                        <span className="px-1 text-sm font-semibold" style={{ color: color.ink }}>
                          {name}
                          {m.memberId === holder && <span title="Account holder"> 👑</span>}
                          {showChannel && <span className="font-normal text-muted"> · {showChannel}</span>}
                        </span>
                      )}
                      <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                        <div
                          className={cn("min-w-0 rounded-2xl px-4 py-2.5 text-[15px] leading-snug text-ink", mine ? "rounded-br-md bg-primary-100" : "rounded-tl-md")}
                          style={mine ? undefined : { backgroundColor: color.soft }}
                        >
                          {m.kind === "poll" && m.poll ? (
                            <PollCard
                              id={m.id}
                              question={m.poll.question}
                              total={votes.filter((v) => v.messageId === m.id).length}
                              options={m.poll.options.map((o) => ({ ...o, count: votes.filter((v) => v.messageId === m.id && v.optionId === o.id).length, mine: votes.some((v) => v.messageId === m.id && v.optionId === o.id && v.memberId === me) }))}
                            />
                          ) : (
                            <>
                              {m.fileId && m.kind === "photo" && (
                                <a href={fileUrl(m.fileId)!} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={fileUrl(m.fileId, true)!} alt="Shared photo" className="mb-1.5 max-h-72 rounded-xl object-cover" loading="lazy" />
                                </a>
                              )}
                              {m.fileId && m.kind === "file" && (
                                <a href={fileUrl(m.fileId)!} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-xl bg-surface/70 px-3 py-2 text-sm font-medium underline-offset-2 hover:underline">
                                  <FileText className="size-5 shrink-0 text-primary-600" />
                                  <span className="truncate">{fileName ?? "File"}</span>
                                  <span className="shrink-0 text-xs text-muted">{fileMime === "application/pdf" ? "PDF" : "Text"}</span>
                                </a>
                              )}
                              {m.body && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>}
                            </>
                          )}
                        </div>
                        <span className="flex shrink-0 items-center gap-0.5 pb-1 text-xs text-muted">
                          {m.pinnedAt && <Pin className="size-3 fill-current text-primary-600" aria-label="Pinned" />}
                          {time}
                          {mine && (seenUntil && seenUntil > m.createdAt ? <CheckCheck className="size-3.5 text-primary-600" aria-label="Seen" /> : <Check className="size-3.5" aria-label="Sent" />)}
                        </span>
                        {tools}
                      </div>
                      <Reactions id={m.id} items={grouped} />
                    </div>
                  </div>
                </li>
              );
            })}
            <li id="chat-end" aria-hidden className="scroll-mb-56 sm:scroll-mb-40" />
          </ol>
        )}
      </section>

      {/* Message box */}
      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-3 border-t border-line bg-canvas px-4 pt-2 pb-2 sm:bottom-0 sm:mx-0 sm:border-t-0 sm:px-0 sm:pb-3">
        {view === "pinned" ? (
          <p className="rounded-2xl bg-sunken px-4 py-3 text-center text-sm text-muted">Pinned messages from all your chats. Open a chat to write.</p>
        ) : (
          <ChatComposer
            channel={view}
            canPost={canPost}
            isParent={viewer.isParent}
            events={upcoming.map((e) => ({ id: e.id, label: `${e.title} · ${eventWhen(e.startsAt, e.allDay)}` }))}
          />
        )}
      </div>
    </div>
  );
}
