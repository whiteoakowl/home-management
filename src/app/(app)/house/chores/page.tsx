import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArchiveRestore, CheckCircle2, Repeat, Trash2 } from "lucide-react";
import { deleteChore, restoreChore } from "@/app/actions/chores";
import { ActionButton } from "@/components/forms/inline";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { kindModule, listChoreTemplates, listOccurrences } from "@/lib/chores";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { describeRule } from "@/lib/recurrence";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Chores" };

const TABS = ["today", "upcoming", "overdue", "done", "all", "archived", "deleted"] as const;
type Tab = (typeof TABS)[number];
const KINDS = ["chore", "cleaning", "maintenance"] as const;

export default async function ChoresPage({ searchParams }: PageProps<"/house/chores">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "today";
  const canManage = viewer.can("chores", "edit");
  // Members default to their own chores; parents to everyone.
  const who = typeof sp.who === "string" ? sp.who : viewer.isParent ? "everyone" : "mine";
  const assigneeId = who === "mine" ? viewer.member.id : who === "everyone" ? undefined : who;
  const today = todayIn(viewer.family.timezone);

  const [members, rooms, cats, todays] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "chore"),
    listOccurrences(viewer, { kinds: [...KINDS], from: today, to: today, assigneeId }),
  ]);

  const rangeOpts = {
    today: { from: today, to: today, statuses: ["pending", "done", "skipped"] as const },
    upcoming: { from: addDays(today, 1), to: addDays(today, 14), statuses: ["pending", "skipped"] as const },
    overdue: { to: addDays(today, -1), statuses: ["pending", "missed"] as const, order: "desc" as const },
    done: { from: addDays(today, -30), to: today, statuses: ["done"] as const, order: "desc" as const },
    all: null,
    archived: null,
    deleted: null,
  }[tab];
  const occurrences = rangeOpts
    ? tab === "today"
      ? todays
      : await listOccurrences(viewer, { kinds: [...KINDS], ...rangeOpts, statuses: [...rangeOpts.statuses], assigneeId })
    : [];
  const templates = tab === "all" ? await listChoreTemplates(viewer, [...KINDS], today) : [];
  // Archived & deleted: every kind (chores, tasks, cleaning, maintenance) in one place, newest first.
  const removed = tab === "archived" || tab === "deleted" ? await listChoreTemplates(viewer, ["chore", "task", "cleaning", "maintenance"], today, { state: tab }) : [];
  const overdueCount = (await listOccurrences(viewer, { kinds: [...KINDS], to: addDays(today, -1), statuses: ["pending"], assigneeId, limit: 99 })).length;

  const doneToday = todays.filter((o) => o.status === "done").length;
  const totalToday = todays.filter((o) => o.status !== "skipped").length;
  const href = (p: Record<string, string>) => `/house/chores?${new URLSearchParams({ tab, who, ...p })}`;

  // Per-member progress for parents viewing everyone.
  const perMember =
    who === "everyone"
      ? members
          .map((m) => {
            const mine = todays.filter((o) => o.assigneeId === m.id && o.status !== "skipped");
            return { ...m, done: mine.filter((o) => o.status === "done").length, total: mine.length };
          })
          .filter((m) => m.total > 0)
      : [];

  const grouped = Map.groupBy(occurrences, (o) => o.dueDate);

  return (
    <>
      <PageHeader
        eyebrow="House"
        title={who === "mine" ? "My chores" : "Chores"}
        description="Recurring chores, cleaning and maintenance, assigned and tracked."
        actions={canManage ? <ChoreFormModal kind="chore" members={members} rooms={rooms} categories={cats} defaultOpen={sp.new === "1"} /> : undefined}
      />
      <HouseTabs active="chores" viewer={viewer} />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <Card className="flex flex-col gap-3 py-4 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">
              Today: {doneToday} of {totalToday} done
            </p>
            {overdueCount > 0 && (
              <Link href={href({ tab: "overdue" })}>
                <Badge tone="wine">{overdueCount} overdue</Badge>
              </Link>
            )}
          </div>
          <ProgressBar value={doneToday} max={Math.max(1, totalToday)} label="Today's chores completed" />
          {perMember.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
              {perMember.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={m.displayName} color={m.color} size="xs" />
                  {m.displayName.split(" ")[0]} <span className="text-muted">{m.done}/{m.total}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-wrap gap-2">
          <SegmentLinks
            active={who === "mine" ? "mine" : who === "everyone" ? "everyone" : "other"}
            items={[
              { key: "mine", href: href({ who: "mine" }), label: "Mine" },
              ...(viewer.can("chores") ? [{ key: "everyone", href: href({ who: "everyone" }), label: "Everyone" }] : []),
            ]}
          />
        </div>
      </div>

      <SegmentLinks
        active={tab}
        items={[
          { key: "today", href: href({ tab: "today" }), label: "Today" },
          { key: "upcoming", href: href({ tab: "upcoming" }), label: "Upcoming" },
          { key: "overdue", href: href({ tab: "overdue" }), label: "Overdue" },
          { key: "done", href: href({ tab: "done" }), label: "Completed" },
          ...(viewer.can("chores")
            ? [
                { key: "all", href: href({ tab: "all" }), label: "All chores" },
                { key: "archived", href: href({ tab: "archived" }), label: "Archived" },
                { key: "deleted", href: href({ tab: "deleted" }), label: "Deleted" },
              ]
            : []),
        ]}
      />

      <div className="mt-5">
        {tab === "archived" || tab === "deleted" ? (
          removed.length === 0 ? (
            <Card>
              <EmptyState
                icon={tab === "deleted" ? <Trash2 /> : <Archive />}
                title={tab === "deleted" ? "No deleted chores" : "No archived chores"}
                description={tab === "deleted" ? "Deleted chores, tasks, cleaning and maintenance land here with their history, and can be restored." : "Archived chores, tasks, cleaning and maintenance land here with their history, and can be restored."}
              />
            </Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {removed.map((t) => {
                const when = (tab === "deleted" ? t.chore.deletedAt : t.chore.archivedAt)!.toISOString().slice(0, 10);
                return (
                  <li key={t.chore.id} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/house/chores/${t.chore.id}`} className="font-semibold hover:text-primary-700">
                        {t.chore.title}
                      </Link>
                      <Badge tone={t.chore.kind === "chore" ? "primary" : "mist"}>{t.chore.kind}</Badge>
                    </div>
                    <p className="text-sm text-muted">
                      {tab === "deleted" ? "Deleted" : "Archived"} {formatShortDate(when)} · done {t.doneCount} time{t.doneCount === 1 ? "" : "s"}
                      {t.assigneeName && ` · ${t.assigneeName}`}
                      {t.roomName && ` · ${t.roomName}`}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      <Link href={`/house/chores/${t.chore.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                        View history
                      </Link>
                      {viewer.can(kindModule(t.chore.kind), "edit") && (
                        <>
                          <ActionButton action={restoreChore} fields={{ id: t.chore.id }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-50 px-3 text-sm font-medium text-primary-700 hover:bg-primary-100">
                            <ArchiveRestore className="size-4" /> Restore
                          </ActionButton>
                          {tab === "archived" && (
                            <ActionButton action={deleteChore} fields={{ id: t.chore.id }} confirm={`Delete "${t.chore.title}"? It moves to Deleted, where you can still view or restore it.`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
                              <Trash2 className="size-4" /> Delete
                            </ActionButton>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : tab === "all" ? (
          templates.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Repeat />}
                title="No chores yet"
                description="Create recurring chores and assign them. They'll show up on everyone's list automatically."
                example="“Feed the dog: daily, Serenity” · “Take out trash: Mon & Thu, Jack”"
                action={canManage ? <ChoreFormModal kind="chore" members={members} rooms={rooms} categories={cats} /> : undefined}
              />
            </Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {templates.map((t) => (
                <li key={t.chore.id}>
                  <Link href={`/house/chores/${t.chore.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{t.chore.title}</p>
                      <Badge tone={t.chore.kind === "chore" ? "primary" : "mist"}>{t.chore.kind}</Badge>
                    </div>
                    <p className="text-sm text-muted">
                      {t.rule ? describeRule(t.rule) : t.chore.dueDate ? `Once · ${formatShortDate(t.chore.dueDate)}` : "No schedule"}
                      {t.roomName && ` · ${t.roomName}`}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-1 text-sm">
                      <span className="flex items-center gap-2">
                        {t.assigneeName ? (
                          <>
                            <Avatar name={t.assigneeName} color={t.assigneeColor} size="xs" />
                            {t.assigneeName}
                          </>
                        ) : (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </span>
                      <span className="text-muted">{t.nextDue ? `Next ${formatShortDate(t.nextDue)}` : ""}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : occurrences.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 />}
              title={{ today: "Nothing due today", upcoming: "Nothing coming up", overdue: "Nothing overdue", done: "Nothing completed yet", all: "" }[tab]}
              description={
                tab === "overdue"
                  ? "Everyone is caught up. Nice!"
                  : tab === "done"
                    ? "Completed chores from the last 30 days show here."
                    : "Chores appear here based on their schedules."
              }
              action={canManage && tab !== "overdue" ? <ChoreFormModal kind="chore" members={members} rooms={rooms} categories={cats} /> : undefined}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {[...grouped.entries()].map(([date, list]) => (
              <section key={date}>
                {tab !== "today" && (
                  <h2 className="mb-2 font-sans text-sm font-semibold text-muted">
                    {date === today ? "Today" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
                  </h2>
                )}
                <OccurrenceList items={list} today={today} members={members} canManage={canManage} showAssignee={who !== "mine"} />
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
