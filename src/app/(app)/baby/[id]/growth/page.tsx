import type { Metadata } from "next";
import { BabyLogModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { logsOfKinds, photoLogs } from "@/lib/baby";
import { babyAge, monthsOld } from "@/lib/baby-kinds";
import { fileUrl } from "@/lib/files";
import { formatShortDate, utcToZoned } from "@/lib/dates";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Baby growth" };

/** A small line chart of one measurement over time. */
function Sparkline({ points, unit, label }: { points: { date: string; v: number }[]; unit: string; label: string }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 120;
  const pad = 8;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const t0 = Date.parse(points[0]!.date);
  const t1 = Date.parse(points[points.length - 1]!.date) || t0 + 1;
  const x = (d: string) => pad + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / Math.max(0.0001, max - min)) * (h - pad * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm font-medium">
        {label}: {vs[vs.length - 1]} {unit} <span className="text-muted">(from {vs[0]} {unit})</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label={`${label} over time`}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary-600" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.date + p.v} cx={x(p.date)} cy={y(p.v)} r="3.5" className="fill-primary-600" />
        ))}
      </svg>
    </figure>
  );
}

export default async function BabyGrowthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await babyContext(id);
  const { viewer, baby, tz, units, now, canUse } = ctx;
  const [logs, names, photos] = await Promise.all([logsOfKinds(baby.id, ["growth"]), memberNames(viewer), photoLogs(baby.id, 120)]);
  const growthPhotos = photos.filter((p) => p.kind === "photo" || p.kind === "growth");
  const months = monthsOld(baby.birthDate, ctx.today);
  const asc = [...logs].reverse();
  const dated = (pick: (l: (typeof logs)[number]) => unknown) =>
    asc.map((l) => ({ date: utcToZoned(l.startedAt, tz).date, v: Number(pick(l)) })).filter((p) => Number.isFinite(p.v) && p.v > 0);
  const lengthUnit = units.weight === "kg" ? "cm" : "in";
  const latest = logs[0];

  return (
    <>
      <BabyHeader ctx={ctx} active="growth" />
      {canUse && (
        <div className="mb-4">
          <BabyLogModal babyId={baby.id} kind="growth" units={units} now={now} triggerLabel="Log weight & length" />
        </div>
      )}
      {latest && (
        <Card className="mb-4">
          <CardHeader title="Growth over time" />
          <div className="grid gap-6 md:grid-cols-3">
            <Sparkline points={dated((l) => l.amount)} unit={units.weight} label="Weight" />
            <Sparkline points={dated((l) => l.data.height)} unit={lengthUnit} label="Length" />
            <Sparkline points={dated((l) => l.data.head)} unit={lengthUnit} label="Head" />
          </div>
          <p className="mt-3 text-sm text-muted">
            Last measured {formatShortDate(utcToZoned(latest.startedAt, tz).date)}
            {baby.birthDate ? ` at ${babyAge(baby.birthDate, utcToZoned(latest.startedAt, tz).date)}` : ""}. Your pediatrician can plot these on a growth chart.
          </p>
        </Card>
      )}
      <Card className="mb-4">
        <CardHeader title="Growth photos" action={canUse ? <BabyLogModal babyId={baby.id} kind="photo" units={units} now={now} defaultTitle={months !== null ? `${months} month${months === 1 ? "" : "s"} old` : undefined} triggerLabel="📸 Add photo" /> : undefined} />
        {growthPhotos.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {growthPhotos.map((p) => (
              <li key={p.id} className="flex flex-col gap-1">
                <a href={fileUrl(p.imageFileId)!} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p.imageFileId, true)!} alt={String(p.data.title ?? "Growth photo")} className="aspect-square w-full rounded-xl object-cover" />
                </a>
                <span className="truncate text-xs text-muted">{String(p.data.title ?? formatShortDate(utcToZoned(p.startedAt, tz).date))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">A photo each month (same spot, same teddy) makes a lovely growth timeline.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Measurements" />
        <LogList ctx={ctx} logs={logs} names={names} showDate empty="Log weight, length and head size after each checkup to see them grow." />
      </Card>
    </>
  );
}
