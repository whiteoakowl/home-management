import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, ne } from "drizzle-orm";
import { Check, Eye, EyeOff, HandHeart, Pencil, Plus, Timer, Undo2 } from "lucide-react";
import { db } from "@/db";
import { faithPracticeLogs, faithPrayers, familyMembers } from "@/db/schema";
import { answerPrayer, deletePractice, deletePrayer, logPractice, reopenPrayer, savePractice, savePrayer, togglePractice, togglePracticeActive } from "@/app/actions/faith";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, FormRow, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { FaithSubTabs } from "@/components/faith/tabs";
import { PracticeCheck } from "@/components/faith/practice-check";
import { fmtDate } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { practicesFor, streak } from "@/lib/faith";
import { FAITH_META, isFaith, PRACTICE_UNITS, type Faith } from "@/lib/faith-config";
import { nameFor } from "@/lib/names";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Practice" };

const UNIT_OPTIONS = [{ value: "", label: "Just check it off" }, ...PRACTICE_UNITS.map((u) => ({ value: u, label: `Count ${u}` }))];
const iconBtn = "size-8 rounded-full text-muted hover:bg-sunken";
const wd = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" });

export default async function FaithDevotions({ params }: PageProps<"/spiritual/faith/[faith]/devotions">) {
  const { faith: raw } = await params;
  if (!isFaith(raw)) redirect("/spiritual");
  const faith: Faith = raw;
  const viewer = await getViewer();
  const meta = FAITH_META[faith];
  const today = todayIn(viewer.family.timezone);
  const me = viewer.member.id;
  const [practices, logs, mine, shared] = await Promise.all([
    practicesFor(viewer, faith),
    db.select().from(faithPracticeLogs).where(and(eq(faithPracticeLogs.memberId, me), gte(faithPracticeLogs.date, addDays(today, -400)))),
    db.select().from(faithPrayers).where(and(eq(faithPrayers.memberId, me), eq(faithPrayers.faith, faith))).orderBy(desc(faithPrayers.createdAt)),
    db
      .select({ p: faithPrayers, m: familyMembers })
      .from(faithPrayers)
      .innerJoin(familyMembers, eq(familyMembers.id, faithPrayers.memberId))
      .where(and(eq(faithPrayers.familyId, viewer.family.id), eq(faithPrayers.faith, faith), eq(faithPrayers.shared, true), ne(faithPrayers.memberId, me)))
      .orderBy(desc(faithPrayers.createdAt))
      .limit(30),
  ]);
  const active = practices.filter((p) => p.active);
  const hidden = practices.filter((p) => !p.active);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const logOf = new Map(logs.map((l) => [`${l.practiceId}:${l.date}`, l]));
  const monthStart = `${today.slice(0, 7)}-01`;
  const open = mine.filter((p) => !p.answeredOn);
  const answered = mine.filter((p) => p.answeredOn);
  const practiceForm = (p?: (typeof practices)[number]) => (
    <>
      {p ? <input type="hidden" name="id" value={p.id} /> : <input type="hidden" name="faith" value={faith} />}
      <FormRow>
        <TextField name="name" label="Practice" required maxLength={80} defaultValue={p?.name} placeholder="Rosary, Gayatri mantra, Daf Yomi…" />
        <TextField name="emoji" label="Symbol (emoji)" maxLength={8} defaultValue={p?.emoji ?? ""} placeholder="🙏" />
      </FormRow>
      <SelectField name="unit" label="Track" options={UNIT_OPTIONS} defaultValue={p?.unit ?? ""} />
    </>
  );

  return (
    <>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600">
            {meta.emoji} {meta.label}
          </p>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Daily practice</h1>
          <p className="mt-1 text-[15px] text-muted">Check off what you did today. Only you see your practice.</p>
        </div>
        <FormModal title="Add a practice" triggerLabel="Add a practice" triggerIcon={<Plus className="size-4" />} triggerVariant="secondary" action={savePractice} size="sm">
          {practiceForm()}
        </FormModal>
      </header>
      <FaithSubTabs faith={faith} active="devotions" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader title={`Today · ${fmtDate(today)}`} icon={<Check className="size-4" />} />
          {active.length ? (
            <ul className="flex flex-col gap-2">
              {active.map((p) => {
                const l = logOf.get(`${p.id}:${today}`);
                return (
                  <li key={p.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <PracticeCheck id={p.id} date={today} done={!!l} name={p.name} emoji={p.emoji} sub={l?.amount != null ? `${l.amount} ${p.unit ?? ""}` : l?.note ?? undefined} />
                    </div>
                    <FormModal title={`${p.name} today`} triggerContent={<Timer className="mx-auto size-4" />} triggerAriaLabel={`Add ${p.unit ?? "a note"} for ${p.name}`} triggerClassName={iconBtn} action={logPractice} size="sm">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="date" value={today} />
                      {p.unit && <NumberField name="amount" label={`How many ${p.unit}?`} min={0} defaultValue={l?.amount ?? undefined} />}
                      <TextAreaField name="note" label="Note" rows={2} defaultValue={l?.note ?? ""} />
                    </FormModal>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<Check />} title="No practices yet" description="Add a practice, or show a hidden one below." />
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="This week" icon={<Timer className="size-4" />} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="pb-2 text-left font-medium text-muted">Practice</th>
                  {week.map((d) => (
                    <th key={d} className={cn("w-9 pb-2 text-center font-medium", d === today ? "text-primary-700" : "text-muted")}>
                      {wd(d)}
                      <span className="block text-[11px] font-normal">{Number(d.slice(8))}</span>
                    </th>
                  ))}
                  <th className="pb-2 pl-2 text-right font-medium text-muted">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {active.map((p) => {
                  const days = new Set(logs.filter((l) => l.practiceId === p.id).map((l) => l.date));
                  const s = streak(days, today);
                  const month = [...days].filter((d) => d >= monthStart).length;
                  return (
                    <tr key={p.id}>
                      <td className="max-w-40 truncate py-1.5 pr-2">
                        <span aria-hidden>{p.emoji}</span> {p.name}
                        <span className="block text-xs text-muted">{month} this month</span>
                      </td>
                      {week.map((d) => {
                        const on = days.has(d);
                        return (
                          <td key={d} className="py-1.5 text-center">
                            <ActionButton action={togglePractice} fields={{ id: p.id, date: d }} label={`${p.name} on ${fmtDate(d)}: ${on ? "done" : "not done"}`} className={cn("size-8 rounded-full border", on ? "border-olive-600 bg-olive-600 text-white" : "border-line hover:border-primary-300")}>
                              {on && <Check className="size-4" />}
                            </ActionButton>
                          </td>
                        );
                      })}
                      <td className="py-1.5 pl-2 text-right tabular-nums">{s ? `🔥 ${s}` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">Change my practices</summary>
            <ul className="mt-2 divide-y divide-line">
              {[...active, ...hidden].map((p) => (
                <li key={p.id} className={cn("flex items-center gap-2 py-1.5", !p.active && "opacity-60")}>
                  <span className="flex-1 truncate">
                    <span aria-hidden>{p.emoji}</span> {p.name} {!p.active && <Badge>Hidden</Badge>}
                  </span>
                  <ActionButton action={togglePracticeActive} fields={{ id: p.id }} label={p.active ? `Hide ${p.name}` : `Show ${p.name}`} className={iconBtn}>
                    {p.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </ActionButton>
                  <FormModal title={`Edit ${p.name}`} triggerContent={<Pencil className="mx-auto size-4" />} triggerAriaLabel={`Edit ${p.name}`} triggerClassName={iconBtn} action={savePractice} size="sm">
                    {practiceForm(p)}
                  </FormModal>
                  {!p.builtinKey && <DeleteButton action={deletePractice} fields={{ id: p.id }} what={`${p.name} and its history`} />}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      </div>

      <section id="prayers" className="mt-8 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <HandHeart className="size-5 text-primary-600" /> {meta.prayersTitle}
          </h2>
          <FormModal title={`Add ${/^[aeiou]/i.test(meta.prayerNoun) ? "an" : "a"} ${meta.prayerNoun}`} triggerLabel="Add" triggerIcon={<Plus className="size-4" />} action={savePrayer} size="sm">
            <input type="hidden" name="faith" value={faith} />
            <TextField name="title" label="What for?" required maxLength={200} placeholder="Healing, a new job, peace in the family…" />
            <TextField name="forWhom" label="For whom (optional)" maxLength={120} />
            <TextAreaField name="details" label="Details" rows={2} />
            <CheckboxField name="shared" label="Share with my family" description="Family members on this path can see it and pray with you." />
          </FormModal>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 [&>*]:min-w-0">
          <Card>
            <CardHeader title="Open" />
            {open.length ? (
              <ul className="divide-y divide-line">
                {open.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {p.title} {p.shared && <Badge tone="primary">Shared</Badge>}
                      </p>
                      {p.forWhom && <p className="text-sm text-muted">For {p.forWhom}</p>}
                      {p.details && <p className="text-sm whitespace-pre-line text-ink-soft">{p.details}</p>}
                      <p className="text-xs text-muted">Since {fmtDate(p.createdAt.toISOString())}</p>
                    </div>
                    <FormModal title="Answered" description="Write down how it was answered, to remember later." triggerLabel="Answered" triggerVariant="soft" triggerSize="sm" action={answerPrayer} size="sm">
                      <input type="hidden" name="id" value={p.id} />
                      <TextAreaField name="answerNote" label="How it was answered (optional)" rows={3} />
                    </FormModal>
                    <FormModal title="Edit" triggerContent={<Pencil className="mx-auto size-4" />} triggerAriaLabel={`Edit ${p.title}`} triggerClassName={iconBtn} action={savePrayer} size="sm">
                      <input type="hidden" name="id" value={p.id} />
                      <TextField name="title" label="What for?" required maxLength={200} defaultValue={p.title} />
                      <TextField name="forWhom" label="For whom (optional)" maxLength={120} defaultValue={p.forWhom ?? ""} />
                      <TextAreaField name="details" label="Details" rows={2} defaultValue={p.details ?? ""} />
                      <CheckboxField name="shared" label="Share with my family" defaultChecked={p.shared} />
                    </FormModal>
                    <DeleteButton action={deletePrayer} fields={{ id: p.id }} what={p.title} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing here yet.</p>
            )}
          </Card>
          <Card>
            <CardHeader title={faith === "christian" ? "Answered prayers" : "Answered & fulfilled"} />
            {answered.length ? (
              <ul className="divide-y divide-line">
                {answered.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <Check className="mr-1 inline size-4 text-olive-600" />
                        {p.title}
                      </p>
                      {p.answerNote && <p className="text-sm whitespace-pre-line text-ink-soft">{p.answerNote}</p>}
                      <p className="text-xs text-muted">{fmtDate(p.answeredOn)}</p>
                    </div>
                    <ActionButton action={reopenPrayer} fields={{ id: p.id }} label="Move back to open" className={iconBtn}>
                      <Undo2 className="size-4" />
                    </ActionButton>
                    <DeleteButton action={deletePrayer} fields={{ id: p.id }} what={p.title} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">When something is answered, mark it here to look back on.</p>
            )}
          </Card>
          {shared.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader title="Shared by my family" />
              <ul className="divide-y divide-line">
                {shared.map(({ p, m }) => (
                  <li key={p.id} className="py-2.5">
                    <p className="font-medium">
                      {p.answeredOn && <Check className="mr-1 inline size-4 text-olive-600" />}
                      {p.title}
                    </p>
                    <p className="text-sm text-muted">
                      {nameFor(viewer, m).split(" ")[0]}
                      {p.forWhom && ` · for ${p.forWhom}`}
                      {p.answeredOn && " · answered"}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
