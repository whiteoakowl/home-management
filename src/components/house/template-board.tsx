import Link from "next/link";
import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { Avatar, Badge } from "@/components/ui/display";
import type { ChoreTemplate } from "@/lib/chores";
import { daysBetween, formatShortDate } from "@/lib/dates";
import { describeRule } from "@/lib/recurrence";

/** Grouped grid of chore templates (cleaning by cadence, maintenance by season…). */
export function TemplateBoard({
  groups,
  today,
  empty,
}: {
  groups: { key: string; label: string; description?: string; items: ChoreTemplate[] }[];
  today: string;
  empty: ReactNode;
}) {
  const nonEmpty = groups.filter((g) => g.items.length);
  if (!nonEmpty.length) return <>{empty}</>;
  return (
    <div className="flex flex-col gap-8">
      {nonEmpty.map((g) => (
        <section key={g.key}>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-xl font-semibold">{g.label}</h2>
            {g.description && <p className="text-sm text-muted">{g.description}</p>}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((t) => {
              const due = t.nextDue ? daysBetween(today, t.nextDue) : null;
              return (
                <li key={t.chore.id}>
                  <Link href={`/house/chores/${t.chore.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{t.chore.title}</p>
                      {due !== null && <Badge tone={due <= 0 ? "olive" : "neutral"}>{due === 0 ? "Today" : due === 1 ? "Tomorrow" : formatShortDate(t.nextDue!)}</Badge>}
                    </div>
                    <p className="text-sm text-muted">
                      {t.rule ? describeRule(t.rule) : "One-time"}
                      {t.roomName && ` · ${t.roomName}`}
                    </p>
                    {t.checklist.length > 0 && <p className="text-sm text-muted">{t.checklist.length}-step checklist</p>}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm">
                      <span className="flex items-center gap-2">
                        {t.assigneeName ? (
                          <>
                            <Avatar name={t.assigneeName} color={t.assigneeColor} size="xs" />
                            {t.assigneeName}
                          </>
                        ) : (
                          <span className="text-muted">Anyone</span>
                        )}
                      </span>
                      <span className="flex items-center gap-3 text-muted">
                        {t.chore.estimatedMinutes ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden />
                            {t.chore.estimatedMinutes}m
                          </span>
                        ) : null}
                        {t.lastDone && <span>Last done {formatShortDate(t.lastDone.slice(0, 10))}</span>}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
