import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { clearBabySchedule, deleteBabyScheduleItem } from "@/app/actions/baby";
import { SchedulePresetModal, ScheduleItemModal } from "@/components/baby/forms";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/display";
import { scheduleFor } from "@/lib/baby";
import { duration, monthsOld, nextScheduled, SCHEDULE_KINDS } from "@/lib/baby-kinds";
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
  const { baby, today, nowMin, canUse } = ctx;
  const items = await scheduleFor(baby.id);
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
