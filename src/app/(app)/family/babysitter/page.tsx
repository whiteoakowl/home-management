import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { AlertTriangle, ArrowLeft, Baby, Printer } from "lucide-react";
import { db } from "@/db";
import { babies, babyLogs, babySchedule, householdInfo, medicalProfiles } from "@/db/schema";
import { BinderFields } from "@/components/binder/binder-item";
import { AutoPrint } from "@/components/meals/week-controls";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/display";
import { Input, Textarea } from "@/components/ui/form";
import { babyAge, BABY_KINDS, monthsOld, SCHEDULE_KINDS, since, wakeWindowFor, duration, type BabyLogKind } from "@/lib/baby-kinds";
import { BINDER, isBinderKind, type BinderKind } from "@/lib/binder";
import { getCalendarItems } from "@/lib/calendar";
import { getViewer, listFamilyMembers } from "@/lib/dal";
import { fmtTime } from "@/lib/dance";
import { addDays, daysBetween, formatShortDate, todayIn, utcToZoned, weekday } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { listMedical } from "@/lib/medical";
import { withViewerNames } from "@/lib/names";

export const metadata: Metadata = { title: "Babysitter form" };

const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const hhmm = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
const txt = (v: unknown, max = 1500) => (typeof v === "string" ? v.slice(0, max).trim() : "");
const long = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const SEVERITY: Record<string, string> = { mild: "Mild", moderate: "Moderate", severe: "Severe", life_threatening: "LIFE-THREATENING" };
/** Sections of Important Info a sitter needs, in order. */
const BINDER_ORDER: BinderKind[] = ["emergency", "phone", "address", "doctor", "insurance", "instructions", "wifi"];

function ageText(birthday: string | null, today: string) {
  if (!birthday) return null;
  const d = daysBetween(birthday, today);
  if (d < 730) return babyAge(birthday, today);
  return `${Math.floor(d / 365.25)} years old`;
}

/**
 * A printable form for a babysitter or grandparent: when you're out and how
 * to reach you, emergency and house information, each child's allergies,
 * medicines, routine and baby care, the kids' plans, and a care log to fill in.
 * Parents only; medical details follow each record's who-can-see setting.
 */
export default async function BabysitterFormPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getViewer();
  if (!viewer.isParent) notFound();
  const sp = await searchParams;
  const tz = viewer.family.timezone;
  const today = todayIn(tz);
  const members = withViewerNames(viewer, await listFamilyMembers(viewer.family.id));
  const kids = members.filter((m) => m.role !== "parent");
  const babyRows = viewer.can("baby") ? await db.select().from(babies).where(and(eq(babies.familyId, viewer.family.id), isNull(babies.archivedAt))).orderBy(asc(babies.birthDate)) : [];
  // Babies that aren't in the family list yet are offered on their own.
  const looseBabies = babyRows.filter((b) => !b.memberId || !members.some((m) => m.id === b.memberId));
  const date = iso(sp.date);

  // ── Step 1: the details ──
  if (!date) {
    const isMinor = (b: string | null) => !b || daysBetween(b, today) < 18 * 365;
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/family" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Family
        </Link>
        <PageHeader eyebrow="Family" title="Babysitter form" description="Print everything a babysitter or grandparent needs: how to reach you, emergency info, each child's allergies, medicines and routine, and a care log to fill in." />
        <Card>
          <form action="/family/babysitter" className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="col-span-2 flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
                Date
                <Input type="date" name="date" required defaultValue={today} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                From
                <Input type="time" name="from" defaultValue="18:00" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Until
                <Input type="time" name="to" defaultValue="23:00" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Last day (if it&apos;s more than one day)
              <Input type="date" name="until" />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Children to include</legend>
              {kids.length + looseBabies.length === 0 && <p className="text-sm text-muted">Add your children under Family first.</p>}
              <div className="grid gap-1 sm:grid-cols-2">
                {kids.map((k) => (
                  <label key={k.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-[15px] hover:bg-sunken">
                    <input type="checkbox" name="kids" value={k.id} defaultChecked={isMinor(k.birthday)} className="size-5 accent-primary-600" />
                    <Avatar name={k.displayName} color={k.color} photoUrl={fileUrl(k.avatarFileId, true)} size="sm" />
                    <span className="min-w-0 truncate">
                      {k.displayName} {k.birthday && <span className="text-muted">· {ageText(k.birthday, today)}</span>}
                    </span>
                  </label>
                ))}
                {looseBabies.map((b) => (
                  <label key={b.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-[15px] hover:bg-sunken">
                    <input type="checkbox" name="kids" value={`baby:${b.id}`} defaultChecked className="size-5 accent-primary-600" />
                    <Baby className="size-6 text-primary-600" aria-hidden />
                    <span className="min-w-0 truncate">
                      {b.name} {b.birthDate && <span className="text-muted">· {babyAge(b.birthDate, today)}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Where we&apos;ll be
                <Input name="where" maxLength={200} placeholder="Dinner at Luigi's, 12 Main St" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Best number to reach us
                <Input name="phone" type="tel" maxLength={60} placeholder="(555) 123-4567" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Bedtime & routine
              <Textarea name="bedtime" rows={2} maxLength={1500} placeholder="Bath at 7, two books, lights out 7:45. Night-light on, door open a crack." />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Meals & snacks
              <Textarea name="meals" rows={2} maxLength={1500} placeholder="Pizza in the freezer (425° for 15 min). One snack after dinner. No candy." />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Rules & screen time
              <Textarea name="rules" rows={2} maxLength={1500} placeholder="30 minutes of tablet after homework. No friends over. Dog goes out at 9." />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Anything else
              <Textarea name="note" rows={2} maxLength={1500} placeholder="Spare key under the planter. Help yourself to anything in the fridge!" />
            </label>
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
              <legend className="mb-1 text-sm font-medium">Include</legend>
              <label className="flex min-h-10 items-center gap-2">
                <input type="checkbox" name="house" value="1" defaultChecked className="size-5 accent-primary-600" /> Emergency & house info
              </label>
              <label className="flex min-h-10 items-center gap-2">
                <input type="checkbox" name="plans" value="1" defaultChecked className="size-5 accent-primary-600" /> The kids&apos; plans
              </label>
              <label className="flex min-h-10 items-center gap-2">
                <input type="checkbox" name="log" value="1" defaultChecked className="size-5 accent-primary-600" /> Care log to fill in
              </label>
              <label className="flex min-h-10 items-center gap-2">
                <input type="checkbox" name="conditions" value="1" defaultChecked className="size-5 accent-primary-600" /> Health conditions
              </label>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="auto" value="print" icon={<Printer className="size-4" />}>
                Print form
              </Button>
              <Button type="submit" variant="secondary">
                Preview
              </Button>
            </div>
            <p className="text-xs text-muted">Only information the whole family can see from Important Info goes on the sheet. Allergies and medicines come from each child&apos;s Medical records and always print, for safety.</p>
          </form>
        </Card>
      </div>
    );
  }

  // ── Step 2: the printable form ──
  let until = iso(sp.until) ?? date;
  if (until < date) until = date;
  if (daysBetween(date, until) > 14) until = addDays(date, 14);
  const from = hhmm(sp.from);
  const to = hhmm(sp.to);
  const picked = (typeof sp.kids === "string" ? [sp.kids] : Array.isArray(sp.kids) ? sp.kids : []).slice(0, 20);
  const chosenKids = kids.filter((k) => picked.includes(k.id));
  const chosenLoose = looseBabies.filter((b) => picked.includes(`baby:${b.id}`));
  const babyFor = (memberId: string) => babyRows.find((b) => b.memberId === memberId) ?? null;
  const notes = { bedtime: txt(sp.bedtime), meals: txt(sp.meals), rules: txt(sp.rules), note: txt(sp.note) };
  const where = txt(sp.where, 200);
  const phone = txt(sp.phone, 60);
  const include = (k: string) => sp[k] === "1";
  const kidIds = chosenKids.map((k) => k.id);

  const allBabies = [...chosenKids.map((k) => babyFor(k.id)).filter((b): b is NonNullable<typeof b> => !!b), ...chosenLoose];
  const babyIds = allBabies.map((b) => b.id);
  const [binder, allergies, restrictions, conditions, meds, profiles, events, schedules, recent] = await Promise.all([
    include("house")
      ? db.select().from(householdInfo).where(and(eq(householdInfo.familyId, viewer.family.id), isNull(householdInfo.privateOwnerId), eq(householdInfo.visibility, "family"))).orderBy(asc(householdInfo.title))
      : Promise.resolve([]),
    viewer.can("medical") ? listMedical(viewer, "allergy") : Promise.resolve([]),
    viewer.can("medical") ? listMedical(viewer, "restriction") : Promise.resolve([]),
    viewer.can("medical") ? listMedical(viewer, "condition") : Promise.resolve([]),
    viewer.can("medical") ? listMedical(viewer, "medication") : Promise.resolve([]),
    viewer.can("medical") && kidIds.length ? db.select().from(medicalProfiles).where(and(eq(medicalProfiles.familyId, viewer.family.id), inArray(medicalProfiles.memberId, kidIds))) : Promise.resolve([]),
    include("plans") && kidIds.length ? getCalendarItems(viewer, date, until, { layers: ["events", "sports", "dance", "chores", "plans"] }) : Promise.resolve([]),
    babyIds.length ? db.select().from(babySchedule).where(inArray(babySchedule.babyId, babyIds)).orderBy(asc(babySchedule.time)) : Promise.resolve([]),
    babyIds.length ? db.select().from(babyLogs).where(and(inArray(babyLogs.babyId, babyIds), inArray(babyLogs.kind, ["bottle", "nursing", "solids", "diaper", "sleep"]))).orderBy(desc(babyLogs.startedAt)).limit(300) : Promise.resolve([]),
  ]);
  const kindOf = (k: string): BinderKind => (isBinderKind(k) ? k : "note");
  const binderItems = binder.filter((r) => BINDER[kindOf(r.kind)].sitter && !(r.kind === "insurance" && r.fields.type && !["health", "dental", "vision"].includes(r.fields.type)));
  const binderSections = BINDER_ORDER.map((k) => ({ k, list: binderItems.filter((r) => r.kind === k) })).filter((s) => s.list.length);
  const kidEvents = events.filter((e) => e.people.some((p) => kidIds.includes(p))).sort((a, b) => a.date.localeCompare(b.date) || (a.startMin ?? -1) - (b.startMin ?? -1));
  const of = <R extends { memberId: string }>(rows: { r: R }[], id: string): R[] => rows.filter((x) => x.r.memberId === id).map((x) => x.r);
  const now = new Date();
  const auto = sp.auto === "print";
  const timeText = `${from ? fmtTime(from) : ""}${from && to ? " – " : ""}${to ? fmtTime(to) : ""}`;

  /** Baby care block (for a baby linked to a child, or a baby on its own). */
  const babyBlock = (b: (typeof babyRows)[number]) => {
    const logs = recent.filter((l) => l.babyId === b.id);
    const last = (k: string) => logs.find((l) => l.kind === k);
    const bottles = logs.filter((l) => l.kind === "bottle" && l.amount).slice(0, 10).map((l) => Number(l.amount)).sort((x, y) => x - y);
    const typical = bottles.length ? bottles[Math.floor(bottles.length / 2)] : null;
    const milk = logs.find((l) => l.kind === "bottle" && l.data.milk)?.data.milk;
    const foods = [...new Set(logs.filter((l) => l.kind === "solids" && l.data.title && l.data.reaction !== "refused").map((l) => String(l.data.title)))].slice(0, 6);
    const routine = schedules.filter((s) => s.babyId === b.id && (!s.days.length || s.days.includes(weekday(date))));
    const ww = wakeWindowFor(monthsOld(b.birthDate, today));
    const lastSleep = last("sleep");
    return (
      <div className="mt-4 flex flex-col gap-3">
        <h3 className="border-b border-line pb-1 font-semibold">👶 Baby care</h3>
        <div className="grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2 print:grid-cols-2">
          <p>
            <strong>Feeding:</strong> {typical ? `about ${typical} ${b.volumeUnit} per bottle` : "see notes"}
            {milk ? ` (${milk === "breast" ? "breast milk" : String(milk)})` : ""}
          </p>
          {foods.length > 0 && (
            <p>
              <strong>Foods they eat:</strong> {foods.join(", ")}
            </p>
          )}
          {ww && (
            <p>
              <strong>Naps:</strong> usually awake {duration(ww.min)}–{duration(ww.max)} between sleeps
            </p>
          )}
          {(["bottle", "nursing", "diaper"] as const).map((k) => {
            const l = last(k);
            return l ? (
              <p key={k}>
                <strong>Last {BABY_KINDS[k as BabyLogKind].label.toLowerCase()}:</strong> {fmtTime(utcToZoned(l.startedAt, tz).time)} ({since(l.startedAt, now)} when printed)
              </p>
            ) : null;
          })}
          {lastSleep && (
            <p>
              <strong>{lastSleep.endedAt ? "Last woke up" : "Asleep since"}:</strong> {fmtTime(utcToZoned(lastSleep.endedAt ?? lastSleep.startedAt, tz).time)}
            </p>
          )}
        </div>
        {b.notes && <p className="rounded-lg bg-sunken/60 px-3 py-2 text-[15px] whitespace-pre-line print:bg-transparent print:px-0">{b.notes}</p>}
        {routine.length > 0 && (
          <>
            <p className="font-medium">Usual routine</p>
            <table className="w-full text-[14px]">
              <tbody>
                {routine.map((s) => (
                  <tr key={s.id} className="border-b border-line">
                    <td className="w-24 py-1 font-semibold tabular-nums">{fmtTime(s.time)}</td>
                    <td className="py-1">
                      {SCHEDULE_KINDS.find((k) => k.value === s.kind)?.emoji} {s.title}
                      {s.minutes ? ` (${duration(s.minutes)})` : ""}
                      {s.notes ? ` · ${s.notes}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="text-[13px] text-muted">Safe sleep: always on their back, in their own crib or bassinet, with nothing else in it.</p>
      </div>
    );
  };

  const careLog = (name: string, baby: boolean) =>
    include("log") ? (
      <div className="mt-4 break-inside-avoid">
        <h3 className="border-b border-line pb-1 font-semibold">📝 Care log for {name.split(" ")[0]}</h3>
        <table className="mt-1 w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              {["Time", baby ? "Fed (how much)" : "Ate / drank", baby ? "Diaper (wet/dirty)" : "Bathroom", "Sleep", "Notes"].map((h) => (
                <th key={h} className="border border-line px-2 py-1 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: baby ? 10 : 6 }, (_, i) => (
              <tr key={i}>
                {[0, 1, 2, 3, 4].map((c) => (
                  <td key={c} className="h-8 border border-line" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

  const medicalBlock = (id: string) => {
    const al = of(allergies, id);
    const re = of(restrictions, id);
    // Allergies and medicines always print (they're about safety); conditions only when chosen.
    const co = include("conditions") ? of(conditions, id).filter((c) => c.active) : [];
    const me = of(meds, id).filter((m) => m.active);
    const prof = profiles.find((p) => p.memberId === id);
    return (
      <>
        {al.length > 0 ? (
          <div className="mt-3 rounded-xl border-2 border-wine-300 bg-wine-50 p-3 print:bg-transparent">
            <p className="flex items-center gap-1.5 font-semibold text-wine-700">
              <AlertTriangle className="size-4" aria-hidden /> ALLERGIES
            </p>
            <ul className="mt-1 flex flex-col gap-1 text-[15px]">
              {al.map((a) => (
                <li key={a.id}>
                  <strong>{a.name}</strong> ({SEVERITY[a.severity] ?? a.severity}){a.reactions ? `: ${a.reactions}` : ""}
                  {a.emergencyInstructions && <span className="block font-medium">What to do: {a.emergencyInstructions}</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-[15px]">
            <strong>Allergies:</strong> none recorded
          </p>
        )}
        <div className="mt-2 grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2 print:grid-cols-2">
          {re.length > 0 && (
            <p>
              <strong>Food rules:</strong> {re.map((r) => `${r.title}${r.foods.length ? ` (no ${r.foods.join(", ")})` : ""}`).join("; ")}
            </p>
          )}
          {co.length > 0 && (
            <p>
              <strong>Health:</strong> {co.map((c) => `${c.name}${c.treatmentNotes ? ` (${c.treatmentNotes})` : ""}`).join("; ")}
            </p>
          )}
          {me.length > 0 && (
            <div>
              <strong>Medicines:</strong>
              <ul className="list-disc pl-5">
                {me.map((m) => (
                  <li key={m.id}>
                    {m.name}
                    {m.dosage ? `, ${m.dosage}` : ""}
                    {m.frequency ? `, ${m.frequency}` : ""}
                    {m.notes ? ` (${m.notes})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {prof?.primaryPhysician && (
            <p>
              <strong>Doctor:</strong> {prof.primaryPhysician}
            </p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AutoPrint when={auto} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/family/babysitter" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Change details
        </Link>
        <PrintButton label="Print form" />
      </div>

      {/* Cover: when, how to reach us, emergency & house info */}
      <section className="print-page mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-[#2b1f2a] print:border-0 print:p-0">
        <p className="text-sm font-medium tracking-[0.2em] text-primary-600 uppercase">The {viewer.family.name} Family</p>
        <h1 className="mt-2 text-4xl font-semibold">Babysitter information</h1>
        <p className="mt-2 text-lg text-ink-soft">
          {long(date)}
          {until !== date ? ` – ${long(until)}` : ""}
          {timeText ? ` · ${timeText}` : ""}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-xl border-2 border-wine-300 p-4">
            <p className="text-lg font-semibold text-wine-700">Emergency: call 911 first</p>
            <p className="text-[15px]">Then call us right away.</p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="font-semibold">How to reach us</p>
            <p className="text-[15px]">{phone || "_______________________"}</p>
            {where && <p className="text-[15px] text-ink-soft">We&apos;ll be at: {where}</p>}
          </div>
        </div>
        <p className="mt-4 text-[15px]">
          <strong>Children:</strong>{" "}
          {[...chosenKids.map((k) => `${k.displayName}${k.birthday ? ` (${ageText(k.birthday, today)})` : ""}`), ...chosenLoose.map((b) => `${b.name}${b.birthDate ? ` (${babyAge(b.birthDate, today)})` : ""}`)].join(", ") || "—"}
        </p>
        {(notes.bedtime || notes.meals || notes.rules || notes.note) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            {(
              [
                ["🌙 Bedtime & routine", notes.bedtime],
                ["🍽️ Meals & snacks", notes.meals],
                ["📏 Rules & screen time", notes.rules],
                ["📌 Also", notes.note],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([h, v]) => (
                <div key={h} className="break-inside-avoid rounded-xl border border-line p-3">
                  <p className="font-semibold">{h}</p>
                  <p className="text-[15px] whitespace-pre-line">{v}</p>
                </div>
              ))}
          </div>
        )}
        {binderSections.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            {binderSections.map(({ k, list }) => (
              <section key={k} className="break-inside-avoid">
                <h2 className="mb-1 border-b border-line pb-1 text-base font-semibold">
                  {BINDER[k].emoji} {BINDER[k].label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                  {list.map((r) => (
                    <div key={r.id} className="break-inside-avoid text-[14px]">
                      <p className="font-semibold">{r.title}</p>
                      <BinderFields kind={k} fields={r.fields} title={r.title} body={r.body} print />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {kidEvents.length > 0 && (
          <div className="mt-6 break-inside-avoid">
            <h2 className="mb-1 border-b border-line pb-1 text-base font-semibold">📅 The kids&apos; plans</h2>
            <ul className="text-[15px]">
              {kidEvents.slice(0, 30).map((e) => (
                <li key={e.key}>
                  {until !== date ? `${formatShortDate(e.date)} · ` : ""}
                  {e.startMin !== null ? fmtTime(`${String(Math.floor(e.startMin / 60)).padStart(2, "0")}:${String(e.startMin % 60).padStart(2, "0")}`) : "All day"} · {e.title}
                  {e.location ? ` (${e.location})` : ""}
                  <span className="text-muted"> · {e.people.map((p) => chosenKids.find((k) => k.id === p)?.displayName.split(" ")[0]).filter(Boolean).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* A page per child */}
      {chosenKids.map((k) => {
        const b = babyFor(k.id);
        return (
          <section key={k.id} className="print-page mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-[#2b1f2a] print:border-0 print:p-0">
            <div className="flex items-center gap-4">
              <Avatar name={k.displayName} color={k.color} photoUrl={fileUrl(k.avatarFileId, true)} size="xl" />
              <div>
                <h2 className="text-3xl font-semibold">{k.displayName}</h2>
                <p className="text-ink-soft">
                  {[ageText(k.birthday, today), k.birthday && `birthday ${formatShortDate(k.birthday)}`].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            {medicalBlock(k.id)}
            {b && (b.allergies || (b.conditions && include("conditions"))) && (
              <p className="mt-2 text-[15px]">
                {b.allergies && (
                  <>
                    <strong>Baby allergies:</strong> {b.allergies}.{" "}
                  </>
                )}
                {b.conditions && include("conditions") && (
                  <>
                    <strong>Health:</strong> {b.conditions}
                  </>
                )}
              </p>
            )}
            {b?.doctorName && (
              <p className="text-[15px]">
                <strong>Pediatrician:</strong> {b.doctorName}
                {b.doctorPhone ? `, ${b.doctorPhone}` : ""}
              </p>
            )}
            {b && babyBlock(b)}
            {careLog(k.displayName, !!b)}
          </section>
        );
      })}
      {chosenLoose.map((b) => (
        <section key={b.id} className="print-page mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-[#2b1f2a] print:border-0 print:p-0">
          <div className="flex items-center gap-4">
            <Avatar name={b.name} photoUrl={fileUrl(b.imageFileId, true)} size="xl" />
            <div>
              <h2 className="text-3xl font-semibold">{b.name}</h2>
              <p className="text-ink-soft">{babyAge(b.birthDate, today) ?? ""}</p>
            </div>
          </div>
          {b.allergies ? (
            <div className="mt-3 rounded-xl border-2 border-wine-300 bg-wine-50 p-3 print:bg-transparent">
              <p className="flex items-center gap-1.5 font-semibold text-wine-700">
                <AlertTriangle className="size-4" aria-hidden /> ALLERGIES
              </p>
              <p className="text-[15px]">{b.allergies}</p>
            </div>
          ) : (
            <p className="mt-3 text-[15px]">
              <strong>Allergies:</strong> none recorded
            </p>
          )}
          {b.conditions && include("conditions") && (
            <p className="text-[15px]">
              <strong>Health:</strong> {b.conditions}
            </p>
          )}
          {b.doctorName && (
            <p className="text-[15px]">
              <strong>Pediatrician:</strong> {b.doctorName}
              {b.doctorPhone ? `, ${b.doctorPhone}` : ""}
            </p>
          )}
          {babyBlock(b)}
          {careLog(b.name, true)}
        </section>
      ))}

      <section className="mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-[#2b1f2a] print:border-0 print:p-0">
        <h2 className="text-xl font-semibold">Notes for the parents</h2>
        <div className="mt-3 flex flex-col gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="border-b border-line" />
          ))}
        </div>
      </section>
    </div>
  );
}
