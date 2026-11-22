import type { Metadata } from "next";
import Link from "next/link";
import { quickBabyLog, startBabyTimer, stopBabyTimer } from "@/app/actions/baby";
import { BabyLogModal, TimerClock } from "@/components/baby/forms";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { dayBounds, lastOfEach, logsBetween, logsOfKinds, remindersFor, runningTimers, scheduleFor, suppliesFor, upcomingAppointments } from "@/lib/baby";
import { BABY_KINDS, dayTotals, duration, monthsOld, napWindow, nextScheduled, nextSide, predictNextFeed, SCHEDULE_KINDS, since, wakeWindowFor, type BabyLogKind } from "@/lib/baby-kinds";
import { fmtTime } from "@/lib/dance";
import { formatShortDate, utcToZoned, weekday } from "@/lib/dates";
import { BabyHeader, babyContext, LogList, memberNames } from "../shared";

export const metadata: Metadata = { title: "Baby tracker" };

const big = "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border border-line bg-surface px-2 py-2 text-center text-sm font-medium hover:border-primary-300 hover:bg-sunken";
const emoji = "text-xl leading-none";

export default async function BabyTodayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await babyContext(id);
  const { viewer, baby, tz, today, nowDate, now, nowMin, units, canUse, others } = ctx;
  const { start, end } = dayBounds(today, tz);
  const [logs, timers, last, schedule, names, recentFeeds, appts, reminders, supplies, notes] = await Promise.all([
    logsBetween(baby.id, start, end),
    runningTimers(baby.id),
    lastOfEach(baby.id, ["nursing", "bottle", "solids", "diaper", "sleep"]),
    scheduleFor(baby.id),
    memberNames(viewer),
    logsOfKinds(baby.id, ["nursing", "bottle"], 30),
    upcomingAppointments(baby.id, nowDate),
    remindersFor(baby.id),
    suppliesFor(viewer, baby.id),
    logsOfKinds(baby.id, ["caregiver"], 1),
  ]);
  const months = monthsOld(baby.birthDate, today);
  const feedGuess = predictNextFeed(recentFeeds.map((l) => l.startedAt));
  const wake = wakeWindowFor(months);
  const lastSleepRow = last.get("sleep");
  const nap = lastSleepRow?.endedAt ? napWindow(lastSleepRow.endedAt, months) : null;
  const meds = logs.filter((l) => (l.kind === "medicine" || l.kind === "vitamin") && l.startedAt >= start);
  const low = supplies.filter((x) => x.kind !== "milk" && x.lowAt !== null && Number(x.quantity) <= Number(x.lowAt));
  const milkSoon = supplies.filter((x) => x.kind === "milk" && x.expiresOn && x.expiresOn <= today);
  const handoff = notes[0];
  const clock = (d: Date) => fmtTime(utcToZoned(d, tz).time);
  const alsoFor = others.map((o) => o.id).join(",");
  const t = dayTotals(logs, start, end, nowDate);
  const lastFeed = [last.get("nursing"), last.get("bottle"), last.get("solids")].filter(Boolean).sort((a, b) => b!.startedAt.getTime() - a!.startedAt.getTime())[0];
  const lastDiaper = last.get("diaper");
  const lastSleep = last.get("sleep");
  const sleepingNow = timers.find((x) => x.kind === "sleep");
  const nursingNow = timers.find((x) => x.kind === "nursing");
  const side = nextSide(last.get("nursing")?.data.side);
  const next = nextScheduled(schedule, nowMin, weekday(today));
  const nextKind = next ? SCHEDULE_KINDS.find((k) => k.value === next.item.kind) : null;
  const todays = logs.filter((l) => l.startedAt >= start);

  const modal = (kind: BabyLogKind, label?: string) => (
    <BabyLogModal
      babyId={baby.id}
      kind={kind}
      units={units}
      now={now}
      others={others}
      suggestedSide={side}
      triggerContent={
        <>
          <span className={emoji} aria-hidden>
            {BABY_KINDS[kind].emoji}
          </span>
          {label ?? BABY_KINDS[kind].label}
        </>
      }
      triggerClassName={big}
    />
  );

  return (
    <>
      <BabyHeader ctx={ctx} active="today" />

      {timers.length > 0 && (
        <Card className="mb-4 border-olive-200 bg-olive-50">
          <ul className="flex flex-col gap-3">
            {timers.map((x) => {
              const k = BABY_KINDS[x.kind as BabyLogKind];
              const s = x.data.side ? ` (${x.data.side})` : "";
              return (
                <li key={x.id} className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {k.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {k.label}
                      {s}
                    </span>
                    <TimerClock startedAt={x.startedAt.toISOString()} />
                  </span>
                  {canUse && x.kind === "nursing" && (
                    <ActionButton action={startBabyTimer} fields={{ babyId: baby.id, kind: "nursing", side: x.data.side === "left" ? "right" : "left" }} className="h-10 rounded-xl bg-surface px-3 text-sm font-medium ring-1 ring-line hover:bg-sunken">
                      Switch to {x.data.side === "left" ? "right" : "left"}
                    </ActionButton>
                  )}
                  {canUse && (
                    <ActionButton action={stopBabyTimer} fields={{ id: x.id }} className="h-10 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">
                      Stop
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {(low.length > 0 || milkSoon.length > 0 || handoff) && (
        <div className="mb-4 flex flex-col gap-2">
          {handoff && (
            <p className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-[15px]">
              🤝 <strong>{handoff.createdByMemberId ? names.get(handoff.createdByMemberId) : "Caregiver"}:</strong> {handoff.notes ?? String(handoff.data.title ?? "")} <span className="text-sm text-muted">({since(handoff.startedAt, nowDate)})</span>
            </p>
          )}
          {low.length > 0 && (
            <Link href={`/baby/${baby.id}/supplies`} className="rounded-2xl border border-olive-100 bg-olive-50 px-4 py-3 text-[15px] text-olive-700">
              🛒 Running low: {low.map((x) => x.name).join(", ")} →
            </Link>
          )}
          {milkSoon.length > 0 && (
            <Link href={`/baby/${baby.id}/supplies`} className="rounded-2xl border border-wine-100 bg-wine-50 px-4 py-3 text-[15px] text-wine-600">
              🍶 {milkSoon.length} bag{milkSoon.length === 1 ? "" : "s"} of breast milk to use or toss today →
            </Link>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <p className="text-sm text-muted">Last feed</p>
          <p className="font-semibold">{nursingNow ? "Nursing now" : lastFeed ? since(lastFeed.startedAt, nowDate) : "—"}</p>
          <p className="text-xs text-muted">{lastFeed ? BABY_KINDS[lastFeed.kind as BabyLogKind].label : ""}{side ? ` · Next side: ${side}` : ""}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Last diaper</p>
          <p className="font-semibold">{lastDiaper ? since(lastDiaper.startedAt, nowDate) : "—"}</p>
          <p className="text-xs text-muted">{lastDiaper?.data.type ? String(lastDiaper.data.type) : ""}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{sleepingNow ? "Sleeping" : "Awake"}</p>
          <p className="font-semibold">{sleepingNow ? `for ${duration((nowDate.getTime() - sleepingNow.startedAt.getTime()) / 60_000)}` : lastSleep?.endedAt ? `for ${duration((nowDate.getTime() - lastSleep.endedAt.getTime()) / 60_000)}` : "—"}</p>
          <p className="text-xs text-muted">{lastSleep && !sleepingNow ? "since last sleep" : ""}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Next feed (estimate)</p>
          <p className="font-semibold">{nursingNow ? "Feeding now" : feedGuess ? `~${clock(feedGuess.at)}` : "—"}</p>
          <p className="text-xs text-muted">{feedGuess ? `About every ${duration(feedGuess.everyMinutes)} lately` : "Log a few feeds to see the rhythm"}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Next nap</p>
          <p className="font-semibold">{sleepingNow ? "Asleep now" : nap ? `${clock(nap.from)}–${clock(nap.to)}` : "—"}</p>
          <p className="text-xs text-muted">{wake ? `Awake ${duration(wake.min)}–${duration(wake.max)} is typical at this age` : "Add a birthday for nap guidance"}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Next up</p>
          {next ? (
            <>
              <p className="font-semibold">
                {nextKind?.emoji} {next.item.title}
              </p>
              <p className="text-xs text-muted">
                {next.tomorrow ? "Tomorrow " : ""}
                {fmtTime(next.item.time)}
              </p>
            </>
          ) : (
            <Link href={`/baby/${baby.id}/schedule`} className="text-sm font-medium text-primary-600 hover:underline">
              Set a schedule →
            </Link>
          )}
        </Card>
      </div>

      {canUse && (
        <Card className="mb-4">
          <CardHeader title="Log" />
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Timers</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["left", "right"] as const).map((s) => (
                  <ActionButton key={s} action={startBabyTimer} fields={{ babyId: baby.id, kind: "nursing", side: s }} className={big}>
                    <span className={emoji} aria-hidden>
                      🤱
                    </span>
                    Nurse {s}
                    {side === s ? " (next)" : ""}
                  </ActionButton>
                ))}
                {!sleepingNow && (
                  <ActionButton action={startBabyTimer} fields={{ babyId: baby.id, kind: "sleep" }} className={big}>
                    <span className={emoji} aria-hidden>
                      😴
                    </span>
                    Start sleep
                  </ActionButton>
                )}
                <ActionButton action={startBabyTimer} fields={{ babyId: baby.id, kind: "tummy" }} className={big}>
                  <span className={emoji} aria-hidden>
                    🧸
                  </span>
                  Tummy time
                </ActionButton>
                <ActionButton action={startBabyTimer} fields={{ babyId: baby.id, kind: "pump" }} className={big}>
                  <span className={emoji} aria-hidden>
                    🍶
                  </span>
                  Pump
                </ActionButton>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Diaper (one tap)</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: "wet", label: "Wet", e: "💧" },
                  { type: "dirty", label: "Dirty", e: "💩" },
                  { type: "both", label: "Both", e: "🧷" },
                ].map((d) => (
                  <ActionButton key={d.type} action={quickBabyLog} fields={{ babyId: baby.id, kind: "diaper", type: d.type }} className={big}>
                    <span className={emoji} aria-hidden>
                      {d.e}
                    </span>
                    {d.label}
                  </ActionButton>
                ))}
              </div>
              {others.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { type: "wet", label: "Wet" },
                    { type: "dirty", label: "Dirty" },
                    { type: "both", label: "Both" },
                  ].map((d) => (
                    <ActionButton key={d.type} action={quickBabyLog} fields={{ babyId: baby.id, kind: "diaper", type: d.type, alsoFor }} className="h-11 rounded-xl text-sm font-medium ring-1 ring-line hover:bg-sunken">
                      {d.label}: {baby.name.split(" ")[0]} + {others.map((o) => o.name.split(" ")[0]).join(" + ")}
                    </ActionButton>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Add details</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {modal("bottle")}
                {modal("nursing", "Nursing")}
                {modal("solids", "Meal")}
                {modal("pump")}
                {modal("diaper")}
                {modal("sleep")}
                {modal("growth")}
                {modal("temperature", "Temp")}
                {modal("medicine")}
                {modal("symptom")}
                {modal("milestone")}
                {modal("note")}
                {modal("bath")}
                {modal("tummy")}
                {modal("activity")}
                {modal("teeth")}
                {modal("doctor", "Doctor")}
                {modal("vaccine")}
                {modal("potty")}
                {modal("vitamin", "Vitamin")}
                {modal("appointment", "Appointment")}
                {modal("caregiver", "Note for caregivers")}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Medicines today" />
          {meds.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {meds.map((m) => (
                <li key={m.id}>
                  {BABY_KINDS[m.kind as BabyLogKind].emoji} {clock(m.startedAt)} · {String(m.data.title ?? "")}
                  {m.data.dose ? ` (${String(m.data.dose)})` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">None logged today.</p>
          )}
          {reminders.some((r) => r.kind === "medicine" && r.enabled) && <p className="mt-2 text-xs text-muted">Medicine reminders are on.</p>}
        </Card>
        <Card>
          <CardHeader title="Appointments" href={`/baby/${baby.id}/health`} hrefLabel="Health" />
          {appts.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {appts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  📅 {formatShortDate(utcToZoned(a.startedAt, tz).date)}, {clock(a.startedAt)} · {String(a.data.title ?? BABY_KINDS[a.kind as BabyLogKind].label)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing coming up.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Reminders" href={`/baby/${baby.id}/schedule`} hrefLabel="Manage" />
          {reminders.filter((r) => r.enabled).length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {reminders
                .filter((r) => r.enabled)
                .slice(0, 5)
                .map((r) => (
                  <li key={r.id}>
                    ⏰ {r.title} · {r.mode === "interval" ? `every ${duration(r.intervalMinutes ?? 0)} since the last` : r.mode === "time" ? `at ${fmtTime(r.time)}` : r.mode === "wake" ? "when the nap window opens" : r.at ? `${formatShortDate(utcToZoned(r.at, tz).date)} ${clock(r.at)}` : ""}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No reminders yet.</p>
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="Today so far" />
        <p className="mb-3 text-[15px] text-ink-soft">
          {t.feeds || t.diapers || t.sleepMinutes
            ? `${baby.name.split(" ")[0]} has had ${t.feeds} feed${t.feeds === 1 ? "" : "s"}${t.bottles ? ` (${t.bottleAmount} ${units.volume} from bottles)` : ""}, ${t.diapers} diaper${t.diapers === 1 ? "" : "s"} and ${duration(t.sleepMinutes)} of sleep so far today.`
            : "Nothing logged yet today."}
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: "Feeds", v: String(t.feeds) },
            { k: "Nursing", v: duration(t.nursingMinutes) },
            { k: "Bottles", v: t.bottles ? `${t.bottleAmount} ${units.volume}` : "0" },
            { k: "Diapers", v: `${t.diapers}`, sub: t.diapers ? `${t.wet} wet · ${t.dirty} dirty` : undefined },
            { k: "Sleep", v: duration(t.sleepMinutes), sub: t.naps ? `${t.naps} sleep${t.naps === 1 ? "" : "s"}` : undefined },
            { k: "Tummy time", v: duration(t.tummyMinutes) },
          ].map((x) => (
            <div key={x.k} className="rounded-xl bg-sunken/60 p-3">
              <dt className="text-xs text-muted">{x.k}</dt>
              <dd className="text-lg font-semibold">{x.v}</dd>
              {x.sub && <dd className="text-xs text-muted">{x.sub}</dd>}
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Today's log"
          action={
            <Link href={`/baby/${baby.id}/track`} className="text-sm font-medium text-primary-600 hover:underline">
              History →
            </Link>
          }
        />
        <LogList ctx={ctx} logs={todays} names={names} empty="Nothing logged yet today. Tap a button above to start." />
      </Card>
    </>
  );
}
