import type { Metadata } from "next";
import { BabyLogModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { logsOfKinds, photoLogs } from "@/lib/baby";
import { BABY_KINDS, type BabyLogKind } from "@/lib/baby-kinds";
import { formatShortDate, monthLabel, utcToZoned } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Baby memories" };

/** Months of age between birth and a date. */
const ageMonths = (birth: string | null, date: string) => {
  if (!birth) return null;
  const b = new Date(`${birth}T12:00:00Z`);
  const d = new Date(`${date}T12:00:00Z`);
  let m = (d.getUTCFullYear() - b.getUTCFullYear()) * 12 + d.getUTCMonth() - b.getUTCMonth();
  if (d.getUTCDate() < b.getUTCDate()) m -= 1;
  return m;
};

/** Photos, the baby journal, firsts and a month-by-month timeline. */
export default async function BabyMemoriesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await babyContext(id);
  const { viewer, baby, units, now, canUse, tz } = ctx;
  const [photos, moments, names] = await Promise.all([photoLogs(baby.id, 300), logsOfKinds(baby.id, ["journal", "milestone", "teeth", "photo", "growth", "development"], 600), memberNames(viewer)]);
  const journal = moments.filter((m) => m.kind === "journal");
  const firsts = moments.filter((m) => m.kind === "milestone" || m.kind === "teeth");
  // Month-by-month: by month of age when there's a birthday, else calendar month.
  const keyOf = (d: Date) => {
    const date = utcToZoned(d, tz).date;
    const m = ageMonths(baby.birthDate, date);
    return m !== null && m >= 0 ? { key: `a${String(m).padStart(3, "0")}`, label: m === 0 ? "First month" : `Month ${m + 1} (${m} month${m === 1 ? "" : "s"} old)` } : { key: `c${date.slice(0, 7)}`, label: monthLabel(`${date.slice(0, 7)}-01`) };
  };
  const months = new Map<string, { label: string; photos: typeof photos; firsts: typeof firsts; journal: number; growth: (typeof moments)[number] | null }>();
  for (const l of moments) {
    const k = keyOf(l.startedAt);
    const m = months.get(k.key) ?? { label: k.label, photos: [], firsts: [], journal: 0, growth: null };
    if (l.kind === "milestone" || l.kind === "teeth") m.firsts.push(l);
    if (l.kind === "journal") m.journal++;
    if (l.kind === "growth" && !m.growth) m.growth = l;
    months.set(k.key, m);
  }
  for (const p of photos) {
    const k = keyOf(p.startedAt);
    const m = months.get(k.key) ?? { label: k.label, photos: [], firsts: [], journal: 0, growth: null };
    m.photos.push(p);
    months.set(k.key, m);
  }
  const ordered = [...months].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <BabyHeader ctx={ctx} active="memories" />
      {canUse && (
        <div className="mb-4 flex flex-wrap gap-2">
          <BabyLogModal babyId={baby.id} kind="photo" units={units} now={now} triggerLabel="📸 Add a photo" />
          <BabyLogModal babyId={baby.id} kind="journal" units={units} now={now} triggerLabel="📖 Write in the journal" />
          <BabyLogModal babyId={baby.id} kind="milestone" units={units} now={now} triggerLabel="⭐ A first" />
        </div>
      )}

      <Card className="mb-4">
        <CardHeader title={`Photos (${photos.length})`} />
        {photos.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {photos.slice(0, sp.view === "all" ? 300 : 24).map((p) => (
              <li key={p.id}>
                <a href={fileUrl(p.imageFileId)!} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p.imageFileId, true)!} alt={String(p.data.title ?? BABY_KINDS[p.kind as BabyLogKind]?.label ?? "Photo")} className="aspect-square w-full rounded-xl object-cover" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Photos you add to milestones, the journal, growth and memories gather here.</p>
        )}
        {photos.length > 24 && sp.view !== "all" && (
          <a href={`/baby/${baby.id}/memories?view=all`} className="mt-3 inline-block text-sm font-medium text-primary-700 hover:underline">
            See all {photos.length} photos →
          </a>
        )}
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Baby journal" />
          <LogList ctx={ctx} logs={journal.slice(0, 30)} names={names} showDate empty="Little stories you'll want to remember." />
        </Card>
        <Card>
          <CardHeader title="Firsts & milestones" />
          <LogList ctx={ctx} logs={firsts.slice(0, 30)} names={names} showDate empty="First smile, first tooth, first steps…" />
        </Card>
      </div>

      <Card>
        <CardHeader title="Month by month" />
        {ordered.length ? (
          <ol className="relative flex flex-col gap-5 border-l-2 border-primary-100 pl-5">
            {ordered.map(([key, m]) => (
              <li key={key} className="relative">
                <span className="absolute top-1.5 -left-[27px] size-3 rounded-full bg-primary-400" aria-hidden />
                <h3 className="font-semibold">{m.label}</h3>
                <p className="text-sm text-muted">
                  {[m.photos.length && `${m.photos.length} photo${m.photos.length === 1 ? "" : "s"}`, m.firsts.length && `${m.firsts.length} first${m.firsts.length === 1 ? "" : "s"}`, m.journal && `${m.journal} journal entr${m.journal === 1 ? "y" : "ies"}`, m.growth?.amount && `${Number(m.growth.amount)} ${units.weight}`].filter(Boolean).join(" · ")}
                </p>
                {m.firsts.length > 0 && <p className="text-[15px]">⭐ {m.firsts.map((f) => String(f.data.title ?? "")).join(", ")}</p>}
                {m.photos.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {m.photos.slice(0, 6).map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} src={fileUrl(p.imageFileId, true)!} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-muted">{formatShortDate(utcToZoned((m.photos[0] ?? m.firsts[0])?.startedAt ?? new Date(), tz).date)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">Your baby&apos;s story, month by month, builds up here as you add photos, firsts and journal entries.</p>
        )}
      </Card>
    </>
  );
}
