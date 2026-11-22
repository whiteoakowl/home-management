import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { clearBabySchedule, deleteBabyScheduleItem } from "@/app/actions/baby";
import { BabyReminderModal, SchedulePresetModal, ScheduleItemModal } from "@/components/baby/forms";
import { deleteBabyReminder, toggleBabyReminder } from "@/app/actions/baby";
import { canChangeItem } from "@/lib/dal";
import { utcToZoned } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/display";
import { remindersFor, scheduleFor } from "@/lib/baby";
import { duration, monthsOld, nextScheduled, SCHEDULE_KINDS, wakeWindowFor } from "@/lib/baby-kinds";
import { fmtTime } from "@/lib/dance";
import { weekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { BabyHeader, babyContext } from "../../shared";

export const metadata: Metadata = { title: "Baby schedule" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** The baby's daily routine, with what's now and what's next. */
export default async function BabySchedulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await babyContext(id);
  const { viewer, baby, today, nowMin, canUse, tz } = ctx;
  const [items, reminders, members] = await Promise.all([scheduleFor(baby.id), remindersFor(baby.id), memberOptions(viewer)]);
  const wake = wakeWindowFor(monthsOld(baby.birthDate, today));
  const wd = weekday(today);
  const day = sp.day && /^[0-6]$/.test(sp.day) ? Number(sp.day) : wd;
  const shown = items.filter((i) => !i.days.length || i.days.includes(day));
  const next = day === wd ? nextScheduled(items, nowMin, wd) : null;
  const age = monthsOld(baby.birthDate, today);
  const suggested = age === null ? "newborn" : age < 4 ? "newborn" : age < 7 ? "infant" : age < 12 ? "older" : "toddler";
  const editBtn = "inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink";

  return (
    <>
      <BabyHeader ctx={ctx} active="schedule" />
      {wake && (
        <Card className="mb-4 bg-primary-50/50">
          <p className="text-[15px]">
            😴 <strong>Sleep guide for {baby.name.split(" ")[0]}&apos;s age:</strong> usually awake {duration(wake.min)}–{duration(wake.max)} between sleeps, with about {wake.naps} naps a day. Every baby is different; use it as a starting point.
          </p>
        </Card>
      )}
      <Card className="mb-4">
        <CardHeader title="Reminders" action={canUse ? <BabyReminderModal babyId={baby.id} members={members} /> : undefined} />
        {reminders.length ? (
          <ul className="divide-y divide-line">
            {reminders.map((r) => {
              const mine = viewer.can("baby", "edit") || canChangeItem(viewer, r.createdByMemberId);
              const z = r.at ? utcToZoned(r.at, tz) : null;
              return (
                <li key={r.id} className={cn("flex items-center gap-3 py-2.5", !r.enabled && "opacity-55")}>
                  <span className="text-xl" aria-hidden>
                    ⏰
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {r.title} {!r.enabled && <Badge>Off</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {r.mode === "interval" ? `${duration(r.intervalMinutes ?? 0)} after the last one` : r.mode === "time" ? `${fmtTime(r.time)}${r.days.length ? ` · ${r.days.map((d) => DAYS[d]).join(", ")}` : " every day"}` : r.mode === "wake" ? "When the nap window opens" : z ? `${z.date} ${fmtTime(z.time)}` : ""}
                      {r.memberIds.length ? ` · to ${r.memberIds.map((m) => members.find((x) => x.id === m)?.displayName.split(" ")[0]).filter(Boolean).join(", ")}` : " · to everyone helping"}
                    </p>
                  </div>
                  {mine && (
                    <span className="flex shrink-0 items-center">
                      <ActionButton action={toggleBabyReminder} fields={{ id: r.id }} className="h-9 rounded-full px-3 text-sm ring-1 ring-line hover:bg-sunken">
                        {r.enabled ? "Pause" : "Turn on"}
                      </ActionButton>
                      <BabyReminderModal babyId={baby.id} members={members} item={{ id: r.id, kind: r.kind, title: r.title, mode: r.mode, intervalMinutes: r.intervalMinutes, time: r.time, days: r.days, atDate: z?.date ?? null, memberIds: r.memberIds }} triggerContent={<Pencil className="size-4" aria-label="Edit reminder" />} triggerClassName={editBtn} />
                      <DeleteButton action={deleteBabyReminder} fields={{ id: r.id }} what={r.title} className="size-8" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Feeding every 3 hours, vitamin D at 9 am, a nap-window nudge, appointments… reminders go to everyone helping, or just the people you pick.</p>
        )}
      </Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canUse && <ScheduleItemModal babyId={baby.id} />}
        {canUse && <SchedulePresetModal babyId={baby.id} hasItems={items.length > 0} suggested={suggested} />}
        {canUse && items.length > 0 && (
          <ActionButton action={clearBabySchedule} fields={{ babyId: baby.id }} confirm="Remove the whole routine?" className="h-9 rounded-lg px-3 text-sm text-muted hover:bg-wine-50 hover:text-wine-500">
            Clear routine
          </ActionButton>
        )}
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<span className="text-3xl">🗓️</span>} title="No schedule yet" description="Build the baby's daily routine (feeds, naps, bath and bedtime) so everyone who helps knows what's next. Start from a sample routine for their age and adjust the times." />
        </Card>
      ) : (
        <Card>
          <CardHeader title={day === wd ? "Today's routine" : `${DAYS[day]}'s routine`} />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <a key={d} href={`/baby/${baby.id}/schedule?day=${i}`} className={cn("rounded-full px-3 py-1 text-sm ring-1 ring-line", i === day ? "bg-primary-600 text-white ring-primary-600" : "hover:bg-sunken")}>
                {d}
              </a>
            ))}
          </div>
          <ol className="divide-y divide-line">
            {shown.map((i) => {
              const k = SCHEDULE_KINDS.find((x) => x.value === i.kind);
              const isNext = next?.item.id === i.id && !next.tomorrow;
              const isNow = day === wd && i.minutes ? toMin(i.time) <= nowMin && nowMin < toMin(i.time) + i.minutes : false;
              const past = day === wd && !isNow && toMin(i.time) + (i.minutes ?? 0) <= nowMin;
              return (
                <li key={i.id} className={cn("flex items-center gap-3 py-2.5", past && "opacity-55")}>
                  <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-primary-700">{fmtTime(i.time)}</span>
                  <span className="text-xl" aria-hidden>
                    {k?.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {i.title}
                      {isNow && <Badge tone="olive">Now</Badge>}
                      {isNext && <Badge tone="primary">Next</Badge>}
                    </p>
                    <p className="text-sm text-muted">{[i.minutes ? duration(i.minutes) : null, i.days.length ? i.days.map((d) => DAYS[d]).join(", ") : null, i.notes].filter(Boolean).join(" · ")}</p>
                  </div>
                  {canUse && (
                    <span className="flex shrink-0 items-center">
                      <ScheduleItemModal babyId={baby.id} item={i} triggerContent={<Pencil className="size-4" />} triggerClassName={editBtn} />
                      <DeleteButton action={deleteBabyScheduleItem} fields={{ id: i.id }} what={i.title} className="size-8" />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {!shown.length && <p className="text-sm text-muted">Nothing planned for this day.</p>}
        </Card>
      )}
    </>
  );
}
