import Link from "next/link";
import { Archive, ArchiveRestore, CheckCircle2, ClipboardCheck, Repeat, Tractor } from "lucide-react";
import { restoreChore } from "@/app/actions/chores";
import { ActionButton } from "@/components/forms/inline";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { listChoreTemplates, listOccurrences } from "@/lib/chores";
import type { Viewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { describeRule } from "@/lib/recurrence";
import { HouseTabs } from "@/app/(app)/house/house-tabs";
import { FarmTabs } from "@/app/(app)/farm/farm-tabs";

const TABS = ["today", "upcoming", "overdue", "done", "all"] as const;
type Tab = (typeof TABS)[number] | "archived";

const COPY = {
  chore: {
    title: "Chores",
    mine: "My chores",
    one: "chore",
    many: "chores",
    description: "Recurring chores, assigned and tracked.",
    empty: "Create recurring chores and assign them. They'll show up on everyone's list automatically.",
    example: "“Feed the dog: daily, Serenity” · “Take out trash: Mon & Thu, Jack”",
    icon: <Repeat />,
  },
  task: {
    title: "Tasks",
    mine: "My tasks",
    one: "task",
    many: "tasks",
    description: "One-off jobs and repeating to-dos: errands, calls, fix-its.",
    empty: "Give a task a due date and an owner. It works just like a chore.",
    example: "“Schedule furnace inspection”, due Friday, Dad",
    icon: <ClipboardCheck />,
  },
  farm: {
    title: "Farm chores",
    mine: "My farm chores",
    one: "farm chore",
    many: "farm chores",
    description: "Feeding, watering, egg collecting, mucking out: recurring farm work, assigned and tracked.",
    empty: "Add the daily and weekly farm jobs and assign them. They earn points like other chores.",
    example: "“Feed & water the chickens: daily, Jack” · “Clean the coop: Saturdays, Serenity”",
    icon: <Tractor />,
  },
} as const;

/**
 * Chores and Tasks share one board: Today / Upcoming / Overdue / Completed / All,
 * Mine or Everyone, today's progress, and Archived behind a button next to Add.
 */
export async function ChoreBoard({ viewer, kind, basePath, sp }: { viewer: Viewer; kind: "chore" | "task" | "farm"; basePath: string; sp: Record<string, string | string[] | undefined> }) {
  const copy = COPY[kind];
  const kinds = [kind] as const;
  const tab: Tab = sp.view === "archived" ? "archived" : TABS.includes(sp.tab as (typeof TABS)[number]) ? (sp.tab as Tab) : "today";
  // Farm chores belong to the Farm area; chores and tasks to Chores.
  const mod = kind === "farm" ? "farm" : "chores";
  const canManage = viewer.can(mod, "edit");
  // "Use" adds their own (assigned to themselves, no points).
  const canAdd = viewer.can(mod, "use");
  // Members default to their own; parents to everyone.
  const who = typeof sp.who === "string" ? sp.who : viewer.isParent ? "everyone" : "mine";
  const assigneeId = who === "mine" ? viewer.member.id : who === "everyone" ? undefined : who;
  const today = todayIn(viewer.family.timezone);

  const [members, rooms, cats, todays] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "chore"),
    listOccurrences(viewer, { kinds: [...kinds], from: today, to: today, assigneeId }),
  ]);

  const rangeOpts =
    tab === "archived" || tab === "all"
      ? null
      : {
          today: { from: today, to: today, statuses: ["pending", "done", "skipped"] as const },
          upcoming: { from: addDays(today, 1), to: addDays(today, kind === "task" ? 60 : 14), statuses: ["pending", "skipped"] as const },
          overdue: { to: addDays(today, -1), statuses: ["pending", "missed"] as const, order: "desc" as const },
          done: { from: addDays(today, -30), to: today, statuses: ["done"] as const, order: "desc" as const },
        }[tab];
  const occurrences = rangeOpts ? (tab === "today" ? todays : await listOccurrences(viewer, { kinds: [...kinds], ...rangeOpts, statuses: [...rangeOpts.statuses], assigneeId })) : [];
  // Archived also lists deleted ones (labelled), so they can still be restored.
  const templates =
    tab === "all"
      ? await listChoreTemplates(viewer, [...kinds], today)
      : tab === "archived"
        ? [...(await listChoreTemplates(viewer, [...kinds], today, { state: "archived" })), ...(await listChoreTemplates(viewer, [...kinds], today, { state: "deleted" }))]
        : [];
  const overdueCount = (await listOccurrences(viewer, { kinds: [...kinds], to: addDays(today, -1), statuses: ["pending"], assigneeId, limit: 99 })).length;

  const doneToday = todays.filter((o) => o.status === "done").length;
  const totalToday = todays.filter((o) => o.status !== "skipped").length;
  const href = (p: Record<string, string>) => `${basePath}?${new URLSearchParams({ tab: tab === "archived" ? "today" : tab, who, ...p })}`;
  const perMember =
    who === "everyone"
      ? members
          .map((m) => {
            const mine = todays.filter((o) => (o.assigneeId === m.id || o.assigneeIds?.includes(m.id)) && o.status !== "skipped");
            return { ...m, done: mine.filter((o) => o.status === "done").length, total: mine.length };
          })
          .filter((m) => m.total > 0)
      : [];
  const grouped = Map.groupBy(occurrences, (o) => o.dueDate);
  const form = (open = false) => <ChoreFormModal kind={kind} members={members} rooms={rooms} categories={cats} defaultOpen={open} limited={!canManage} />;

  return (
    <>
      <PageHeader
        eyebrow={kind === "farm" ? "Farm" : "House"}
        title={tab === "archived" ? `Archived ${copy.many}` : who === "mine" ? copy.mine : copy.title}
        description={tab === "archived" ? `${copy.title} you've put away. Restore one to bring it back.` : copy.description}
        actions={
          canAdd ? (
            <>
              {!canManage ? null : tab === "archived" ? (
                <ButtonLink href={basePath} variant="secondary" icon={<Repeat className="size-4" />}>
                  Back to {copy.many}
                </ButtonLink>
              ) : (
                <ButtonLink href={`${basePath}?view=archived`} variant="secondary" icon={<Archive className="size-4" />}>
                  Archived
                </ButtonLink>
              )}
              {form(sp.new === "1" || sp.new === kind)}
            </>
          ) : undefined
        }
      />
      {kind === "farm" ? <FarmTabs active="chores" /> : <HouseTabs active={kind === "task" ? "tasks" : "chores"} viewer={viewer} />}

      {tab === "archived" ? (
        templates.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <li key={t.chore.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                <Link href={`/house/chores/${t.chore.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {t.chore.title} {t.chore.deletedAt && <Badge tone="wine">Deleted</Badge>}
                  </p>
                  <p className="text-sm text-muted">
                    {t.chore.deletedAt ? "Deleted" : "Archived"} {formatShortDate(((t.chore.deletedAt ?? t.chore.archivedAt) as Date).toISOString().slice(0, 10))}
                    {t.team.length ? ` · ${t.team.map((p) => p.name).join(", ")}` : t.assigneeName ? ` · ${t.assigneeName}` : ""}
                  </p>
                </Link>
                <ActionButton action={restoreChore} fields={{ id: t.chore.id }} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
                  <ArchiveRestore className="size-4" /> Restore
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <EmptyState icon={<Archive />} title={`No archived ${copy.many}`} description={`When you archive a ${copy.one}, it moves here. Its history is kept.`} />
          </Card>
        )
      ) : (
        <>
          <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
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
              <ProgressBar value={doneToday} max={Math.max(1, totalToday)} label={`Today's ${copy.many} completed`} />
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
            <SegmentLinks
              fit
              active={who === "mine" ? "mine" : who === "everyone" ? "everyone" : "other"}
              items={[
                { key: "mine", href: href({ who: "mine" }), label: "Mine" },
                ...(viewer.can(mod) ? [{ key: "everyone", href: href({ who: "everyone" }), label: "Everyone" }] : []),
              ]}
            />
          </div>

          <SegmentLinks
            fit
            active={tab}
            items={[
              { key: "today", href: href({ tab: "today" }), label: "Today" },
              { key: "upcoming", href: href({ tab: "upcoming" }), label: "Upcoming" },
              { key: "overdue", href: href({ tab: "overdue" }), label: "Overdue" },
              { key: "done", href: href({ tab: "done" }), label: "Done" },
              ...(viewer.can(mod) ? [{ key: "all", href: href({ tab: "all" }), label: kind === "task" ? "All tasks" : kind === "farm" ? "All farm" : "All chores" }] : []),
            ]}
          />

          <div className="mt-5">
            {tab === "all" ? (
              templates.length === 0 ? (
                <Card>
                  <EmptyState icon={copy.icon} title={`No ${copy.many} yet`} description={copy.empty} example={copy.example} action={canAdd ? form() : undefined} />
                </Card>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {templates.map((t) => (
                    <li key={t.chore.id}>
                      <Link href={`/house/chores/${t.chore.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
                        <p className="font-semibold">{t.chore.title}</p>
                        <p className="text-sm text-muted">
                          {t.rule ? describeRule(t.rule) : t.chore.dueDate ? `Once · ${formatShortDate(t.chore.dueDate)}` : "No schedule"}
                          {t.roomName && ` · ${t.roomName}`}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-1 text-sm">
                          <span className="flex items-center gap-2">
                            {t.team.length > 1 ? (
                              <>
                                <span className="flex -space-x-1.5">
                                  {t.team.slice(0, 3).map((p) => (
                                    <Avatar key={p.id} name={p.name} color={p.color} size="xs" className="ring-2 ring-surface" />
                                  ))}
                                </span>
                                {t.team.map((p) => p.name).join(", ")}
                              </>
                            ) : t.assigneeName ? (
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
                  title={{ today: "Nothing due today", upcoming: "Nothing coming up", overdue: "Nothing overdue", done: "Nothing completed yet" }[tab as "today"]}
                  description={tab === "overdue" ? "Everyone is caught up. Nice!" : tab === "done" ? `Completed ${copy.many} from the last 30 days show here.` : `${copy.title} appear here based on their due dates.`}
                  action={canAdd && tab !== "overdue" ? form() : undefined}
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
      )}
    </>
  );
}
