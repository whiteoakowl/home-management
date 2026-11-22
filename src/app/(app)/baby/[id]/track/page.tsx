import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BabyLogModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { SegmentLinks } from "@/components/ui/tabs";
import { dayBounds, logsBetween } from "@/lib/baby";
import { BABY_KINDS, dayTotals, duration, LOG_KINDS, type BabyLogKind } from "@/lib/baby-kinds";
import { addDays, formatShortDate, weekday } from "@/lib/dates";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Track" };

const SECTIONS: { title: string; kinds: BabyLogKind[] }[] = [
  { title: "Feeding", kinds: ["nursing", "bottle", "solids"] },
  { title: "Pumping", kinds: ["pump"] },
  { title: "Diapers & potty", kinds: ["diaper", "potty"] },
  { title: "Sleep", kinds: ["sleep"] },
  { title: "Bath & care", kinds: ["bath", "tummy", "activity", "nails", "hair", "brush", "skin"] },
  { title: "Health", kinds: ["medicine", "vitamin", "temperature", "symptom"] },
  { title: "Growth", kinds: ["growth"] },
];

const GROUPS: { key: string; label: string; kinds?: BabyLogKind[] }[] = [
  { key: "all", label: "Everything" },
  { key: "feeding", label: "Feeding", kinds: LOG_KINDS.filter((k) => BABY_KINDS[k].group === "feeding") },
  { key: "pump", label: "Pumping", kinds: ["pump"] },
  { key: "diaper", label: "Diapers & potty", kinds: ["diaper", "potty"] },
  { key: "sleep", label: "Sleep", kinds: ["sleep"] },
  { key: "care", label: "Care", kinds: LOG_KINDS.filter((k) => BABY_KINDS[k].group === "care") },
  { key: "health", label: "Health", kinds: LOG_KINDS.filter((k) => BABY_KINDS[k].group === "health") },
  { key: "growth", label: "Growth", kinds: ["growth"] },
  { key: "notes", label: "Notes", kinds: ["note", "caregiver", "journal", "development"] },
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day by day: everything logged, plus a week at a glance. */
export default async function BabyHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; show?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await babyContext(id);
  const { viewer, baby, tz, today, nowDate, units, now, canUse, others } = ctx;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;
  const group = GROUPS.find((g) => g.key === sp.show) ?? GROUPS[0]!;
  const weekStart = addDays(day, -6);
  const { start } = dayBounds(weekStart, tz);
  const { end } = dayBounds(day, tz);
  const [weekLogs, names] = await Promise.all([logsBetween(baby.id, start, end), memberNames(viewer)]);
  const dayB = dayBounds(day, tz);
  const shown = weekLogs.filter((l) => l.startedAt >= dayB.start && l.startedAt < dayB.end && (!group.kinds || group.kinds.includes(l.kind as BabyLogKind)));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
    const b = dayBounds(d, tz);
    return { d, t: dayTotals(weekLogs, b.start, b.end, nowDate) };
  });
  const q = (d: string) => `/baby/${baby.id}/track?day=${d}${group.key !== "all" ? `&show=${group.key}` : ""}`;

  return (
    <>
      <BabyHeader ctx={ctx} active="track" />
      {canUse && (
        <Card className="mb-4 flex flex-col gap-4">
          <CardHeader title="Log something" />
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <p className="mb-2 text-sm font-medium text-muted">{sec.title}</p>
              <div className="flex flex-wrap gap-2">
                {sec.kinds.map((k) => (
                  <BabyLogModal
                    key={k}
                    babyId={baby.id}
                    kind={k}
                    units={units}
                    now={now}
                    others={others}
                    triggerContent={
                      <>
                        <span aria-hidden>{BABY_KINDS[k].emoji}</span> {BABY_KINDS[k].label}
                      </>
                    }
                    triggerClassName="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:bg-sunken"
                  />
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card className="mb-4 overflow-x-auto">
        <CardHeader title="Week at a glance" />
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 font-medium">Feeds</th>
              <th className="py-1 font-medium">Bottles</th>
              <th className="py-1 font-medium">Nursing</th>
              <th className="py-1 font-medium">Diapers</th>
              <th className="py-1 font-medium">Sleep</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {week.map(({ d, t }) => (
              <tr key={d} className={d === day ? "font-semibold" : undefined}>
                <td className="py-1.5">
                  <Link href={q(d)} className="hover:underline">
                    {DAYS[weekday(d)]} {formatShortDate(d)}
                  </Link>
                </td>
                <td>{t.feeds}</td>
                <td>{t.bottles ? `${t.bottleAmount} ${units.volume}` : "—"}</td>
                <td>{t.nursingMinutes ? duration(t.nursingMinutes) : "—"}</td>
                <td>{t.diapers ? `${t.diapers} (${t.wet}💧 ${t.dirty}💩)` : "—"}</td>
                <td>{t.sleepMinutes ? duration(t.sleepMinutes) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={q(addDays(day, -1))} aria-label="Previous day" className="inline-flex size-9 items-center justify-center rounded-full ring-1 ring-line hover:bg-sunken">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-28 text-center font-semibold">{day === today ? "Today" : `${DAYS[weekday(day)]} ${formatShortDate(day)}`}</span>
        {day < today && (
          <Link href={q(addDays(day, 1))} aria-label="Next day" className="inline-flex size-9 items-center justify-center rounded-full ring-1 ring-line hover:bg-sunken">
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="mb-4">
        <SegmentLinks active={group.key} items={GROUPS.map((g) => ({ key: g.key, href: `/baby/${baby.id}/track?day=${day}${g.key !== "all" ? `&show=${g.key}` : ""}`, label: g.label }))} />
      </div>
      <Card>
        <LogList ctx={ctx} logs={shown} names={names} empty="Nothing logged." />
      </Card>
    </>
  );
}
