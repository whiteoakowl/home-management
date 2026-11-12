import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { archiveChore } from "@/app/actions/chores";
import { ActionButton } from "@/components/forms/inline";
import { ChoreFormModal } from "@/components/house/chore-form";
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
  const [t] = await listChoreTemplates(viewer, ["chore", "cleaning", "maintenance", "task"], today, { choreId: id });
  if (!t) notFound();
  const kind = t.chore.kind;
  const mod = kindModule(kind);
  const canManage = viewer.can(mod, "edit");

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
  const back = { chore: "/house/chores", task: "/house/tasks", cleaning: "/house/cleaning", maintenance: "/house/maintenance" }[kind];

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
          canManage ? (
            <>
              <ChoreFormModal kind={kind} members={members} rooms={rooms} categories={cats} defaults={toChoreDefaults(t)} />
              <ActionButton
                action={archiveChore}
                fields={{ id, redirectTo: back }}
                confirm="Archive this? Upcoming occurrences are removed; history is kept."
                className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
              >
                <Archive className="size-4" /> Archive
              </ActionButton>
            </>
          ) : undefined
        }
      />

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
          <OccurrenceList items={upcoming} today={today} members={members} canManage={canManage} />
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
                  <th className="py-2 font-medium">When</th>
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
