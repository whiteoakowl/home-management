import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, ArchiveRestore, Trash2, Undo2 } from "lucide-react";
import { archiveChore, deleteChore, deleteOccurrenceRecord, restoreChore, undoCompletion } from "@/app/actions/chores";
import { ActionButton } from "@/components/forms/inline";
import { ChoreFormModal } from "@/components/house/chore-form";
import { MaintenanceCostModal } from "@/components/maintenance/cost-modal";
import { formatCents } from "@/lib/utils";
import { toChoreDefaults } from "@/components/house/chore-defaults";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader, ProgressRing } from "@/components/ui/display";
import { kindModule, listChoreTemplates, listOccurrences } from "@/lib/chores";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { describeRule } from "@/lib/recurrence";

export const metadata: Metadata = { title: "Chore" };

const STATUS_TONE = { done: "primary", missed: "wine", skipped: "neutral", pending: "olive" } as const;

export default async function ChoreDetailPage({ params }: PageProps<"/house/chores/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  const today = todayIn(viewer.family.timezone);
  const ALL = ["chore", "cleaning", "maintenance", "task", "farm"] as const;
  const t =
    (await listChoreTemplates(viewer, [...ALL], today, { choreId: id }))[0] ??
    (await listChoreTemplates(viewer, [...ALL], today, { choreId: id, state: "archived" }))[0] ??
    (await listChoreTemplates(viewer, [...ALL], today, { choreId: id, state: "deleted" }))[0];
  if (!t) notFound();
  const state = t.chore.deletedAt ? "deleted" : t.chore.archivedAt ? "archived" : "active";
  const kind = t.chore.kind;
  const mod = kindModule(kind);
  const manager = viewer.can(mod, "edit");
  // Members with Use manage the chores they added themselves.
  const canManage = manager || (viewer.can(mod, "use") && t.chore.createdByMemberId === viewer.member.id);
  // Parents (and Add & edit) can correct records: "didn't really do it" takes the points back.
  const fixer = viewer.isParent || manager;

  const [members, rooms, cats, upcoming, history] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, kind === "chore" || kind === "task" ? "chore" : "household"),
    listOccurrences(viewer, { kinds: [kind], choreId: id, from: today, to: addDays(today, 14), statuses: ["pending", "skipped"] }),
    listOccurrences(viewer, { kinds: [kind], choreId: id, to: today, statuses: ["done", "missed", "skipped"], order: "desc", limit: 60 }),
  ]);
  if (!canManage && !viewer.can(mod) && upcoming.length === 0 && history.length === 0) notFound();

  const finished = t.doneCount + t.missedCount;
  const rate = finished ? Math.round((t.doneCount / finished) * 100) : null;
  const back = { chore: "/house/chores", task: "/house/tasks", cleaning: "/house/cleaning", maintenance: "/maintenance/schedule", farm: "/farm/chores" }[kind];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <PageHeader
        eyebrow={<span className="capitalize">{kind}</span>}
        title={t.chore.title}
        description={[t.rule ? describeRule(t.rule) : t.chore.dueDate ? `Due ${formatShortDate(t.chore.dueDate)}` : null, t.roomName, t.categoryName].filter(Boolean).join(" · ")}
        actions={
          canManage && state !== "active" ? (
            <>
              <ActionButton action={restoreChore} fields={{ id }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700">
                <ArchiveRestore className="size-4" /> Restore
              </ActionButton>
              {state === "archived" && (
                <ActionButton action={deleteChore} fields={{ id }} confirm="Delete this? It stays in Archived, where you can still view or restore it." className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
                  <Trash2 className="size-4" /> Delete
                </ActionButton>
              )}
            </>
          ) : canManage ? (
            <>
              <ChoreFormModal kind={kind} members={members} rooms={rooms} categories={cats} defaults={toChoreDefaults(t)} limited={!manager} />
              <ActionButton
                action={archiveChore}
                fields={{ id, redirectTo: back }}
                confirm="Archive this? Upcoming occurrences are removed; history is kept."
                className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
              >
                <Archive className="size-4" /> Archive
              </ActionButton>
              <ActionButton
                action={deleteChore}
                fields={{ id, redirectTo: back }}
                confirm="Delete this? It stays in Archived, where you can still view or restore it. Its history and points are kept."
                className="h-9 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50"
              >
                <Trash2 className="size-4" /> Delete
              </ActionButton>
            </>
          ) : undefined
        }
      />

      {state !== "active" && (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-sunken px-4 py-3 text-[15px] text-ink-soft">
          {state === "deleted" ? <Trash2 className="size-4" /> : <Archive className="size-4" />}
          {state === "deleted" ? `Deleted ${formatShortDate(t.chore.deletedAt!.toISOString().slice(0, 10))}.` : `Archived ${formatShortDate(t.chore.archivedAt!.toISOString().slice(0, 10))}.`} It isn&apos;t scheduled anymore; its history is kept.
          {canManage ? " Restore it to start scheduling it again." : ""}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4">
          <ProgressRing value={t.doneCount} max={Math.max(1, finished)} size={64}>
            {rate === null ? "–" : `${rate}%`}
          </ProgressRing>
          <div>
            <p className="font-semibold">Completion rate</p>
            <p className="text-sm text-muted">
              {t.doneCount} done · {t.missedCount} missed
            </p>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-muted">Assigned to</p>
          <p className="mt-1 flex items-center gap-2 font-semibold">
            {t.assigneeName ? (
              <>
                <Avatar name={t.assigneeName} color={t.assigneeColor} size="sm" /> {t.assigneeName}
              </>
            ) : (
              "Anyone"
            )}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Next due</p>
          <p className="mt-1 font-semibold">{t.nextDue ? formatShortDate(t.nextDue) : "Not scheduled"}</p>
          {t.chore.estimatedMinutes && <p className="text-sm text-muted">~{t.chore.estimatedMinutes} min</p>}
        </Card>
      </div>

      {(t.chore.instructions || t.checklist.length > 0 || t.chore.notes) && (
        <Card>
          <CardHeader title="How it's done" />
          {t.chore.instructions && <p className="mb-3 whitespace-pre-line text-[15px] text-ink-soft">{t.chore.instructions}</p>}
          {t.checklist.length > 0 && (
            <ul className="flex flex-col gap-2">
              {t.checklist.map((c) => {
                const m = members.find((x) => x.id === c.assigneeId);
                return (
                  <li key={c.id} className="flex items-center gap-3 text-[15px]">
                    <span className="size-5 rounded-md border-2 border-line-strong" aria-hidden />
                    <span className="flex-1">{c.text}</span>
                    {m && <Avatar name={m.displayName} color={m.color} size="xs" />}
                  </li>
                );
              })}
            </ul>
          )}
          {t.chore.notes && <p className="mt-3 text-sm text-muted">{t.chore.notes}</p>}
        </Card>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Coming up</h2>
          <OccurrenceList items={upcoming} today={today} members={members} canManage={manager} />
        </section>
      )}

      <Card>
        <CardHeader title="Completion history" />
        {history.length === 0 ? (
          <EmptyState compact icon={<Archive />} title="No history yet" description="Every time this is done, skipped or missed it's recorded here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-4 font-medium">Due</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Assigned</th>
                  <th className="py-2 pr-4 font-medium">Completed by</th>
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Points</th>
                  {kind === "maintenance" && <th className="py-2 font-medium">Cost</th>}
                  {fixer && <th className="py-2 font-medium"><span className="sr-only">Fix</span></th>}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-line/60">
                    <td className="py-2 pr-4">{formatShortDate(h.dueDate)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={STATUS_TONE[h.status]}>{h.status}</Badge>
                    </td>
                    <td className="py-2 pr-4">{h.assigneeName ?? "—"}</td>
                    <td className="py-2 pr-4">{h.completedByName ?? "—"}</td>
                    <td className="py-2 text-muted">
                      {h.completedAt?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: viewer.family.timezone }) ?? "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{h.pointsAwarded == null ? "—" : h.awardedMemberIds.length > 1 ? `${h.pointsAwarded} each (${h.awardedMemberIds.length} people)` : h.pointsAwarded}</td>
                    {kind === "maintenance" && (
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1">
                          {h.actualCostCents !== null ? formatCents(h.actualCostCents) : "—"}
                          {canManage && h.status === "done" && <MaintenanceCostModal occurrenceId={h.id} current={h.actualCostCents} canBudget={viewer.can("budget", "edit")} />}
                        </span>
                      </td>
                    )}
                    {fixer && (
                      <td className="py-2">
                        <span className="flex items-center justify-end gap-1">
                          {(h.status === "done" || h.status === "skipped") && (
                            <ActionButton
                              action={undoCompletion}
                              fields={{ id: h.id }}
                              confirm={
                                h.status === "skipped"
                                  ? `Un-skip ${formatShortDate(h.dueDate)} and put it back on the list?`
                                  : `Put ${formatShortDate(h.dueDate)} back on the list as not done${h.pointsAwarded ? ` and take back ${h.pointsAwarded} points from ${h.completedByName ?? "them"}` : ""}?`
                              }
                              label={h.status === "skipped" ? "Un-skip" : "Mark not done"}
                              title={h.status === "skipped" ? "Put it back on the list" : "Didn't really do it: put it back on the list and take back the points"}
                              className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-xs font-medium whitespace-nowrap hover:bg-sunken"
                            >
                              <Undo2 className="size-3.5" /> Undo
                            </ActionButton>
                          )}
                          <ActionButton
                            action={deleteOccurrenceRecord}
                            fields={{ id: h.id }}
                            confirm={`Delete the ${formatShortDate(h.dueDate)} record${h.pointsAwarded ? ` and its ${h.pointsAwarded} points` : ""}?`}
                            label="Delete record"
                            className="size-8 rounded-full text-muted hover:bg-wine-50 hover:text-wine-500"
                          >
                            <Trash2 className="size-3.5" />
                          </ActionButton>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
