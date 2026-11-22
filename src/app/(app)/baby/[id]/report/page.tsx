import type { Metadata } from "next";
import Link from "next/link";
import { dayBounds, logsInRange, logsOfKinds } from "@/lib/baby";
import { babyAge, BABY_KINDS, dayTotals, duration, isFever, logSummary, periodReport, type BabyLogKind } from "@/lib/baby-kinds";
import { addDays, formatShortDate, utcToZoned } from "@/lib/dates";
import { PrintButton } from "@/components/binder/print-button";
import { babyContext } from "../../shared";

export const metadata: Metadata = { title: "Pediatrician summary" };

/** A one-page, printable summary to bring to a checkup. */
export default async function PediatricianSummary({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await babyContext(id);
  const { baby, tz, today, nowDate, units } = ctx;
  const n = Math.min(90, Math.max(3, Number(sp.days) || 14));
  const first = addDays(today, -(n - 1));
  const [logs, growth, health, milestones] = await Promise.all([
    logsInRange(baby.id, dayBounds(addDays(first, -1), tz).start, dayBounds(today, tz).end),
    logsOfKinds(baby.id, ["growth"], 6),
    logsOfKinds(baby.id, ["medicine", "vitamin", "symptom", "temperature", "vaccine", "doctor"], 60),
    logsOfKinds(baby.id, ["milestone", "teeth"], 20),
  ]);
  const days = Array.from({ length: n }, (_, i) => {
    const b = dayBounds(addDays(first, i), tz);
    return dayTotals(logs, b.start, b.end, nowDate);
  });
  const r = periodReport(days, logs.filter((l) => l.kind === "pump").map((l) => Number(l.amount ?? 0)));
  const solids = logs.filter((l) => l.kind === "solids" && (l.data.firstTry || l.data.allergy));
  const recentHealth = health.filter((h) => h.startedAt <= nowDate && utcToZoned(h.startedAt, tz).date >= first);
  const date = (d: Date) => formatShortDate(utcToZoned(d, tz).date);

  return (
    <article className="mx-auto max-w-3xl bg-surface p-6 text-[15px] print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/baby/${baby.id}/reports`} className="text-sm font-medium text-primary-700 hover:underline">
          ← Reports
        </Link>
        <PrintButton />
      </div>
      <h1 className="text-2xl font-semibold">{baby.name}: summary for the pediatrician</h1>
      <p className="text-muted">
        {[babyAge(baby.birthDate, today), baby.birthDate && `born ${formatShortDate(baby.birthDate)}`, `last ${n} days (${formatShortDate(first)} – ${formatShortDate(today)})`].filter(Boolean).join(" · ")}
      </p>
      <section className="mt-4">
        <h2 className="font-semibold">Health record</h2>
        <p>Allergies: {baby.allergies || "none recorded"} · Conditions: {baby.conditions || "none recorded"}</p>
      </section>
      <section className="mt-4">
        <h2 className="font-semibold">Daily averages</h2>
        <ul className="list-disc pl-5">
          <li>
            Feeds: {r.feedsPerDay}/day{r.bottlePerDay ? `, bottles ${r.bottlePerDay} ${units.volume}/day` : ""}
            {r.nursingMinutes ? `, nursing ${duration(Math.round(r.nursingMinutes / n))}/day` : ""}
          </li>
          <li>Sleep: {duration(r.sleepPerDay)}/day (as logged)</li>
          <li>
            Diapers: {r.diapersPerDay}/day ({r.wet} wet, {r.dirty} dirty in {n} days)
          </li>
          {r.pumpSessions > 0 && (
            <li>
              Pumping: {r.pumpSessions} sessions, {r.pumpTotal} {units.volume}
            </li>
          )}
        </ul>
      </section>
      <section className="mt-4">
        <h2 className="font-semibold">Growth</h2>
        {growth.length ? (
          <ul className="list-disc pl-5">
            {growth.map((g) => (
              <li key={g.id}>
                {date(g.startedAt)}: {logSummary(g, units, nowDate)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No measurements logged.</p>
        )}
      </section>
      <section className="mt-4">
        <h2 className="font-semibold">Health in this period</h2>
        {recentHealth.length ? (
          <ul className="list-disc pl-5">
            {recentHealth.map((h) => (
              <li key={h.id}>
                {date(h.startedAt)} · {BABY_KINDS[h.kind as BabyLogKind]?.label}: {logSummary(h, units, nowDate)}
                {isFever(h) ? " (fever)" : ""}
                {h.notes ? `. ${h.notes}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nothing logged.</p>
        )}
      </section>
      {solids.length > 0 && (
        <section className="mt-4">
          <h2 className="font-semibold">New foods & reactions</h2>
          <ul className="list-disc pl-5">
            {solids.map((s) => (
              <li key={s.id}>
                {date(s.startedAt)}: {logSummary(s, units, nowDate)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-4">
        <h2 className="font-semibold">Milestones</h2>
        {milestones.length ? <p>{milestones.map((m) => `${String(m.data.title ?? "")} (${date(m.startedAt)})`).join("; ")}</p> : <p className="text-muted">None logged.</p>}
      </section>
      <section className="mt-4">
        <h2 className="font-semibold">Questions for the doctor</h2>
        <div className="mt-1 h-28 rounded-lg border border-dashed border-line" />
      </section>
    </article>
  );
}
