import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { deleteBabyLog } from "@/app/actions/baby";
import { BabyLogModal, BabyModal, type LogDefaults } from "@/components/baby/forms";
import { DeleteButton } from "@/components/forms/inline";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { LinkTabs } from "@/components/ui/tabs";
import type { babyLogs } from "@/db/schema";
import { canChangeLog, canManageBaby, getBaby, listBabies } from "@/lib/baby";
import { babyAge, BABY_KINDS, isFever, logSummary, type BabyLogKind } from "@/lib/baby-kinds";
import { getViewer, type Viewer } from "@/lib/dal";
import { formatShortDate, todayIn, utcToZoned } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type BabyLog = typeof babyLogs.$inferSelect;

/** Everything a baby page needs: viewer, the baby, family-local "now" and units. */
export async function babyContext(id: string) {
  const viewer = await getViewer();
  if (!viewer.can("baby")) notFound();
  const baby = await getBaby(viewer, id);
  if (!baby) notFound();
  const tz = viewer.family.timezone;
  const nowDate = new Date();
  const local = utcToZoned(nowDate, tz);
  return {
    viewer,
    baby,
    tz,
    today: todayIn(tz),
    nowDate,
    now: { date: local.date, time: local.time },
    nowMin: local.minutes,
    units: { volume: baby.volumeUnit, weight: baby.weightUnit },
    canUse: viewer.can("baby", "use"),
    /** Other babies in the family (twins…), for "Also log for". */
    others: (await listBabies(viewer)).filter((b) => b.id !== baby.id).map((b) => ({ id: b.id, name: b.name })),
  };
}

export type BabyCtx = Awaited<ReturnType<typeof babyContext>>;

/** Header with the baby's photo, age and switcher, plus the tabs. */
export async function BabyHeader({ ctx, active }: { ctx: BabyCtx; active: string }) {
  const { viewer, baby, today } = ctx;
  const [all, members] = await Promise.all([listBabies(viewer), canManageBaby(viewer, baby) ? memberOptions(viewer) : Promise.resolve([])]);
  const photo = fileUrl(baby.imageFileId, true);
  const age = babyAge(baby.birthDate, today);
  return (
    <>
      <PageHeader
        eyebrow="Baby tracker"
        title={
          <span className="flex items-center gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-12 rounded-full object-cover" />
            ) : (
              <Avatar name={baby.name} size="lg" />
            )}
            {baby.name}
          </span>
        }
        description={[age, baby.birthDate && `Born ${formatShortDate(baby.birthDate)}`].filter(Boolean).join(" · ") || undefined}
        actions={
          canManageBaby(viewer, baby) ? (
            <BabyModal
              members={members}
              item={{ ...baby, imageUrl: fileUrl(baby.imageFileId, true) }}
              triggerContent={
                <>
                  <Pencil className="size-4" /> Edit
                </>
              }
              triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
            />
          ) : undefined
        }
      />
      {all.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {all.map((b) => (
            <Link key={b.id} href={`/baby/${b.id}`} className={cn("rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-line", b.id === baby.id ? "bg-primary-600 text-white ring-primary-600" : "bg-surface hover:bg-sunken")}>
              {b.name}
            </Link>
          ))}
          <Link href="/baby?all=1" className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-sunken">
            All babies
          </Link>
        </div>
      )}
      <LinkTabs
        active={active}
        tabs={[
          { key: "today", href: `/baby/${baby.id}`, label: "Dashboard" },
          { key: "track", href: `/baby/${baby.id}/track`, label: "Track" },
          { key: "schedule", href: `/baby/${baby.id}/schedule`, label: "Schedule & reminders" },
          { key: "development", href: `/baby/${baby.id}/development`, label: "Development" },
          { key: "health", href: `/baby/${baby.id}/health`, label: "Health" },
          { key: "growth", href: `/baby/${baby.id}/growth`, label: "Growth" },
          { key: "memories", href: `/baby/${baby.id}/memories`, label: "Memories" },
          { key: "supplies", href: `/baby/${baby.id}/supplies`, label: "Supplies" },
          { key: "family", href: `/baby/${baby.id}/family`, label: "Family" },
          { key: "reports", href: `/baby/${baby.id}/reports`, label: "Reports" },
        ]}
      />
    </>
  );
}

/** Form defaults for editing a log, in family-local time. */
export function logDefaults(l: BabyLog, tz: string): LogDefaults {
  const s = utcToZoned(l.startedAt, tz);
  return {
    id: l.id,
    kind: l.kind,
    date: s.date,
    time: s.time,
    endTime: l.endedAt ? utcToZoned(l.endedAt, tz).time : null,
    minutes: l.endedAt ? Math.round((l.endedAt.getTime() - l.startedAt.getTime()) / 60_000) : null,
    amount: l.amount,
    data: l.data,
    notes: l.notes,
    imageUrl: fileUrl(l.imageFileId, true),
  };
}

const timeLabel = (d: Date, tz: string) => {
  const z = utcToZoned(d, tz);
  const [h, m] = z.time.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** A list of logs with edit/delete for those the viewer may change. */
export function LogList({ ctx, logs, names, showDate = false, empty }: { ctx: BabyCtx; logs: BabyLog[]; names: Map<string, string>; showDate?: boolean; empty: string }) {
  const { viewer, baby, tz, units, nowDate, now } = ctx;
  if (!logs.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {logs.map((l) => {
        const meta = BABY_KINDS[l.kind as BabyLogKind] ?? BABY_KINDS.note;
        const summary = logSummary(l, units, nowDate);
        const photo = fileUrl(l.imageFileId, true);
        const by = l.createdByMemberId ? names.get(l.createdByMemberId) : null;
        const changeable = canChangeLog(viewer, l);
        return (
          <li key={l.id} className="flex items-center gap-3 py-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-xl" aria-hidden>
              {meta.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 font-medium">
                {meta.label}
                {isFever(l) && <Badge tone="wine">Fever</Badge>}
                {l.endedAt === null && meta.timer && <Badge tone="olive">Now</Badge>}
              </p>
              <p className="text-sm text-muted">
                {[showDate ? `${formatShortDate(utcToZoned(l.startedAt, tz).date)}, ${timeLabel(l.startedAt, tz)}` : timeLabel(l.startedAt, tz), summary, l.notes, by && `by ${by}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
            )}
            {changeable && (
              <span className="flex shrink-0 items-center">
                <BabyLogModal babyId={baby.id} kind={(l.kind in BABY_KINDS ? l.kind : "note") as BabyLogKind} units={units} now={now} item={logDefaults(l, tz)} triggerContent={<Pencil className="size-4" />} triggerClassName="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink" />
                <DeleteButton action={deleteBabyLog} fields={{ id: l.id }} what={`this ${meta.label.toLowerCase()}`} className="size-8" />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Who logged what: member names for the "by Sarah" line. */
export async function memberNames(viewer: Viewer) {
  return new Map((await memberOptions(viewer)).map((m) => [m.id, m.displayName.split(" ")[0]!]));
}
