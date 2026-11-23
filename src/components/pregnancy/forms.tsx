"use client";

import { useState, useTransition, type ReactNode } from "react";
import { recordBirth, saveBirthPlan, savePregnancy, savePregnancyAppointment, savePregnancyEntry, savePregnancyItem, savePregnancyLog, saveReminders, saveWeekContent, updatePregnancyItem } from "@/app/actions/pregnancy";
import { runVoid } from "@/components/forms/inline";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, NumberField, SelectField, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";
import { APPOINTMENT_KINDS, BABY_COUNT, BIRTH_PLAN_SECTIONS, DOC_CATEGORIES, ITEM_STATUSES, JOURNAL_CATEGORIES, MEASURES, PHOTO_CATEGORIES, QUESTION_CATEGORIES, SEVERITY, SYMPTOMS } from "@/lib/pregnancy/catalog";
import type { WeekContent } from "@/lib/pregnancy/weeks";
import { cn } from "@/lib/utils";

const s = (v: unknown) => (v == null ? "" : String(v));
const opts = <T extends { value: string | number; label: string }>(xs: readonly T[]) => xs.map((x) => ({ value: String(x.value), label: x.label }));

// ─── Setup / edit ───────────────────────────────────────────────────────────

export type PregnancyDefaults = {
  id: string;
  memberId: string;
  nickname: string | null;
  babyNickname: string | null;
  babySex: string;
  dueDate: string | null;
  lmpDate: string | null;
  conceptionDate: string | null;
  dueSource: string;
  ivf: { transferDate: string | null; embryoDays: number | null; notes: string | null } | null;
  pregnancyNumber: number | null;
  previousPregnancies: string | null;
  babyCount: number;
  provider: string | null;
  providerPhone: string | null;
  providerEmail: string | null;
  providerAddress: string | null;
  hospital: string | null;
  birthLocation: string | null;
  notes: string | null;
  visibility: "family" | "private" | "selected" | "parents";
  shared: string[];
  letEdit: boolean;
};

/** Guided setup (new) or full edit. Every field but one date is optional. */
export function PregnancyForm({ members, me, isParent, item }: { members: MemberOption[]; me: string; isParent: boolean; item?: PregnancyDefaults }) {
  const [how, setHow] = useState<"due" | "lmp" | "conception" | "ivf">(item?.ivf?.transferDate ? "ivf" : item?.dueSource === "lmp" ? "lmp" : item?.dueSource === "conception" ? "conception" : "due");
  const step = (n: number, title: string, children: ReactNode, hint?: string) => (
    <fieldset className="flex flex-col gap-4 rounded-2xl border border-line p-4 sm:p-5">
      <legend className="px-1 text-[15px] font-semibold">
        <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary-600 text-xs text-white">{n}</span>
        {title}
      </legend>
      {hint && <p className="-mt-2 text-sm text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
  return (
    <ActionForm action={savePregnancy} submitLabel={item ? "Save changes" : "Start tracking"} resetOnSuccess={false} showSuccess={!!item}>
      {item && <input type="hidden" name="id" value={item.id} />}
      {step(
        1,
        "About this pregnancy",
        <>
          {!item && isParent && members.length > 1 && (
            <SelectField name="memberId" label="Who's pregnant?" defaultValue={me} options={members.map((m) => ({ value: m.id, label: m.id === me ? `${m.displayName} (me)` : m.displayName }))} />
          )}
          <FormRow>
            <TextField name="nickname" label="Name for this pregnancy" defaultValue={item?.nickname ?? ""} placeholder="Our second baby" maxLength={80} />
            <TextField name="babyNickname" label="Baby's nickname" defaultValue={item?.babyNickname ?? ""} placeholder="Peanut, Bean" maxLength={80} />
          </FormRow>
          <FormRow cols={3}>
            <SelectField name="babyCount" label="How many babies" defaultValue={s(item?.babyCount ?? 1)} options={opts(BABY_COUNT)} />
            <SelectField
              name="babySex"
              label="Baby's sex"
              defaultValue={item?.babySex ?? "unknown"}
              options={[
                { value: "unknown", label: "Don't know yet" },
                { value: "surprise", label: "Keeping it a surprise" },
                { value: "girl", label: "Girl" },
                { value: "boy", label: "Boy" },
                { value: "mixed", label: "Mixed (twins+)" },
              ]}
            />
            <NumberField name="pregnancyNumber" label="Pregnancy number" min={1} max={30} defaultValue={item?.pregnancyNumber ?? ""} placeholder="1" />
          </FormRow>
        </>,
      )}
      {step(
        2,
        "Dates",
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="How do you want to set the dates?">
            {(
              [
                ["due", "I know my due date"],
                ["lmp", "First day of last period"],
                ["conception", "Conception date"],
                ["ivf", "IVF transfer"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className={cn("flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm", how === v ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}>
                <input type="radio" className="sr-only" checked={how === v} onChange={() => setHow(v)} />
                {l}
              </label>
            ))}
          </div>
          {how === "due" && (
            <FormRow>
              <DateField name="dueDate" label="Estimated due date" defaultValue={item?.dueDate ?? ""} />
              <CheckboxField name="dueFromUltrasound" label="Set (or changed) by an ultrasound" defaultChecked={item?.dueSource === "ultrasound"} />
            </FormRow>
          )}
          {how === "lmp" && <DateField name="lmpDate" label="First day of your last period" defaultValue={item?.lmpDate ?? ""} hint="We'll estimate a due date 40 weeks after this." />}
          {how === "conception" && <DateField name="conceptionDate" label="Conception date" defaultValue={item?.conceptionDate ?? ""} hint="We'll estimate a due date 38 weeks after this." />}
          {how === "ivf" && (
            <>
              <FormRow>
                <DateField name="ivfTransfer" label="Transfer date" defaultValue={item?.ivf?.transferDate ?? ""} />
                <SelectField
                  name="embryoDays"
                  label="Embryo age at transfer"
                  defaultValue={s(item?.ivf?.embryoDays ?? 5)}
                  options={[
                    { value: "3", label: "Day 3" },
                    { value: "5", label: "Day 5 (blastocyst)" },
                    { value: "6", label: "Day 6" },
                  ]}
                />
              </FormRow>
              <TextAreaField name="ivfNotes" label="IVF notes" rows={2} defaultValue={item?.ivf?.notes ?? ""} maxLength={500} />
            </>
          )}
          {/* Keep the other dates when editing so switching tabs doesn't erase them. */}
          {how !== "lmp" && item?.lmpDate && <input type="hidden" name="lmpDate" value={item.lmpDate} />}
          {how !== "conception" && item?.conceptionDate && <input type="hidden" name="conceptionDate" value={item.conceptionDate} />}
          <p className="text-xs text-muted">Due dates are estimates: most babies arrive in the weeks around it. Your provider may adjust it after an ultrasound.</p>
        </>,
      )}
      {step(
        3,
        "Care team",
        <>
          <FormRow>
            <TextField name="provider" label="Provider (doctor, midwife)" defaultValue={item?.provider ?? ""} maxLength={120} />
            <TextField name="providerPhone" label="Phone" type="tel" defaultValue={item?.providerPhone ?? ""} maxLength={40} />
          </FormRow>
          <FormRow>
            <TextField name="providerEmail" label="Email or portal" defaultValue={item?.providerEmail ?? ""} maxLength={120} />
            <TextField name="providerAddress" label="Office address" defaultValue={item?.providerAddress ?? ""} maxLength={200} />
          </FormRow>
          <FormRow>
            <TextField name="hospital" label="Hospital" defaultValue={item?.hospital ?? ""} maxLength={200} />
            <TextField name="birthLocation" label="Preferred birth location" defaultValue={item?.birthLocation ?? ""} placeholder="Hospital, birth center, home" maxLength={200} />
          </FormRow>
        </>,
        "Optional. Handy for appointments and the birth plan.",
      )}
      {step(
        4,
        "Sharing",
        <>
          <VisibilityField members={members.filter((m) => m.id !== (item?.memberId ?? me))} defaultValue={item?.visibility ?? "parents"} defaultSelected={item?.shared ?? []} privateHint="Only you (and whoever set this up) will see this pregnancy." />
          <CheckboxField name="letEdit" label="Selected people can also add and edit" description="Otherwise they can see it but not change it. Good for a partner." defaultChecked={item?.letEdit ?? true} />
          <p className="text-xs text-muted">Appointments go on the family calendar with the same sharing.</p>
        </>,
      )}
      {step(
        5,
        "Notes",
        <>
          <TextAreaField name="previousPregnancies" label="Previous pregnancies (optional)" rows={2} defaultValue={item?.previousPregnancies ?? ""} maxLength={1000} hint="Only if you'd like to keep notes here." />
          <TextAreaField name="notes" label="Other notes" rows={3} defaultValue={item?.notes ?? ""} maxLength={4000} />
        </>,
      )}
    </ActionForm>
  );
}

// ─── Logs ───────────────────────────────────────────────────────────────────

export type PLogKind = "symptom" | "mood" | "weight" | "measure" | "hydration" | "meal" | "sleep";
export type PLogDefaults = { id: string; date: string; time: string; amount: string | null; minutes: number | null; endTime: string | null; data: Record<string, unknown>; notes: string | null };

const LOG_TITLE: Record<PLogKind, string> = { symptom: "Log a symptom", mood: "Log mood", weight: "Log weight", measure: "Add a health reading", hydration: "Log water", meal: "Log a meal or snack", sleep: "Log sleep" };

function Scale({ name, label, low, high, defaultValue }: { name: string; label: string; low: string; high: string; defaultValue?: unknown }) {
  const [v, setV] = useState(s(defaultValue));
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">{label}</legend>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={cn("flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium", v === String(n) ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}>
            <input type="radio" name={name} value={n} checked={v === String(n)} onChange={() => setV(String(n))} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-xs text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </fieldset>
  );
}

export function PregnancyLogModal({ pregnancyId, kind, now, item, weightUnit = "lb", triggerContent, triggerClassName, triggerLabel }: { pregnancyId: string; kind: PLogKind; now: { date: string; time: string }; item?: PLogDefaults; weightUnit?: string; triggerContent?: ReactNode; triggerClassName?: string; triggerLabel?: string }) {
  const d = item?.data ?? {};
  const [measure, setMeasure] = useState(s(d.type) || "bp");
  const known = SYMPTOMS.includes(s(d.symptom) as (typeof SYMPTOMS)[number]);
  return (
    <FormModal title={item ? "Edit" : LOG_TITLE[kind]} triggerLabel={triggerLabel ?? LOG_TITLE[kind]} triggerVariant="secondary" triggerContent={triggerContent} triggerClassName={triggerClassName} action={savePregnancyLog} submitLabel={item ? "Save" : "Save"} size="sm">
      <input type="hidden" name="pregnancyId" value={pregnancyId} />
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      {kind !== "sleep" && (
        <FormRow>
          <DateField name="date" label="Date" defaultValue={item?.date ?? now.date} />
          <TextField name="time" type="time" label="Time" defaultValue={item?.time ?? now.time} />
        </FormRow>
      )}
      {kind === "symptom" && (
        <>
          <SelectField name="symptom" label="Symptom" defaultValue={known ? s(d.symptom) : ""} placeholder="Something else (type below)" options={SYMPTOMS.map((x) => ({ value: x, label: x }))} />
          <TextField name="custom" label="Or describe it" defaultValue={known ? "" : s(d.symptom)} maxLength={80} />
          <FormRow>
            <SelectField name="severity" label="How strong" defaultValue={s(d.severity) || "1"} options={opts(SEVERITY)} />
            <NumberField name="minutes" label="How long (minutes)" min={0} defaultValue={item?.minutes ?? ""} />
          </FormRow>
        </>
      )}
      {kind === "mood" && (
        <>
          <Scale name="mood" label="Mood" low="Low" high="Great" defaultValue={d.mood} />
          <Scale name="energy" label="Energy" low="Drained" high="Energetic" defaultValue={d.energy} />
          <Scale name="stress" label="Stress" low="Calm" high="Very stressed" defaultValue={d.stress} />
          <Scale name="sleepQuality" label="Last night's sleep" low="Poor" high="Restful" defaultValue={d.sleepQuality} />
        </>
      )}
      {kind === "weight" && (
        <FormRow>
          <NumberField name="amount" label="Weight" min={0} defaultValue={item?.amount ?? ""} required />
          <SelectField name="unit" label="Unit" defaultValue={s(d.unit) || weightUnit} options={[{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }]} />
        </FormRow>
      )}
      {kind === "measure" && (
        <>
          <SelectField name="type" label="Reading" value={measure} onChange={(e) => setMeasure(e.target.value)} options={MEASURES.map((m) => ({ value: m.value, label: m.label }))} />
          {measure === "bp" ? (
            <FormRow cols={3}>
              <NumberField name="systolic" label="Top number" defaultValue={s(d.systolic)} />
              <NumberField name="diastolic" label="Bottom number" defaultValue={s(d.diastolic)} />
              <NumberField name="pulse" label="Pulse (optional)" defaultValue={s(d.pulse)} />
            </FormRow>
          ) : (
            <FormRow cols={3}>
              {measure === "other" && <TextField name="label" label="What" defaultValue={s(d.label)} maxLength={60} />}
              <NumberField name="amount" label="Reading" defaultValue={item?.amount ?? ""} />
              <TextField name="unit" label="Unit" defaultValue={s(d.unit) || MEASURES.find((m) => m.value === measure)?.unit} maxLength={20} />
            </FormRow>
          )}
          <p className="text-xs text-muted">For your records and to share with your provider. The app doesn&apos;t interpret readings. Ask your provider what&apos;s right for you.</p>
        </>
      )}
      {kind === "hydration" && <NumberField name="amount" label="Glasses of water" min={1} max={50} defaultValue={item?.amount ?? "1"} />}
      {kind === "meal" && (
        <>
          <SelectField name="type" label="Meal" defaultValue={s(d.type) || "snack"} options={[{ value: "breakfast", label: "Breakfast" }, { value: "lunch", label: "Lunch" }, { value: "dinner", label: "Dinner" }, { value: "snack", label: "Snack" }]} />
          <TextField name="what" label="What you had" defaultValue={s(d.what)} required maxLength={300} />
        </>
      )}
      {kind === "sleep" && (
        <>
          <DateField name="date" label="Morning of" defaultValue={item?.date ?? now.date} />
          <FormRow>
            <TextField name="bed" type="time" label="Went to bed" defaultValue={s(d.bed) || "22:30"} />
            <TextField name="wake" type="time" label="Woke up" defaultValue={item?.endTime ?? "07:00"} />
          </FormRow>
          <FormRow>
            <SelectField name="quality" label="How well you slept" defaultValue={s(d.quality) || "3"} options={["Very poorly", "Poorly", "OK", "Well", "Very well"].map((l, i) => ({ value: String(i + 1), label: l }))} />
            <NumberField name="wakeUps" label="Times you woke up" min={0} defaultValue={s(d.wakeUps)} />
          </FormRow>
        </>
      )}
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} maxLength={2000} />
    </FormModal>
  );
}

// ─── Questions, medicines, names, checklist items ───────────────────────────

export type ItemDefaults = { id: string; title: string; list: string | null; status: string | null; notes: string | null; rating: number | null; appointmentId: string | null; data: Record<string, unknown> };

export function PregnancyItemModal({
  pregnancyId,
  kind,
  item,
  list,
  appointments = [],
  triggerContent,
  triggerClassName,
  triggerLabel,
}: {
  pregnancyId: string;
  kind: "question" | "medication" | "name" | "checklist";
  item?: ItemDefaults;
  list?: string;
  appointments?: { id: string; label: string }[];
  triggerContent?: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const d = item?.data ?? {};
  const title = { question: item ? "Edit question" : "Add questions", medication: item ? "Edit medicine or supplement" : "Add a medicine or supplement", name: item ? "Edit name" : "Add names", checklist: item ? "Edit item" : "Add to the list" }[kind];
  const many = !item && kind !== "medication";
  return (
    <FormModal title={title} triggerLabel={triggerLabel ?? title} triggerVariant="secondary" triggerContent={triggerContent} triggerClassName={triggerClassName} action={savePregnancyItem} size="sm">
      <input type="hidden" name="pregnancyId" value={pregnancyId} />
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      {kind === "checklist" && <input type="hidden" name="list" value={item?.list ?? list ?? "custom"} />}
      {many ? (
        <TextAreaField name="title" label={kind === "question" ? "Questions (one per line)" : kind === "name" ? "Names (one per line)" : "Items (one per line)"} rows={3} required />
      ) : (
        <TextField name="title" label={kind === "medication" ? "Name" : kind === "question" ? "Question" : "Name"} defaultValue={item?.title ?? ""} required maxLength={200} />
      )}
      {kind === "question" && (
        <FormRow>
          <SelectField name="list" label="Topic" defaultValue={item?.list ?? list ?? "other"} options={QUESTION_CATEGORIES} />
          {appointments.length > 0 && <SelectField name="appointmentId" label="Ask at" defaultValue={item?.appointmentId ?? ""} placeholder="Any appointment" options={appointments.map((a) => ({ value: a.id, label: a.label }))} />}
        </FormRow>
      )}
      {kind === "medication" && (
        <>
          <FormRow>
            <TextField name="dose" label="Dose (as prescribed)" defaultValue={s(d.dose)} maxLength={80} />
            <TextField name="schedule" label="When" defaultValue={s(d.schedule)} placeholder="Once a day with breakfast" maxLength={120} />
          </FormRow>
          <FormRow>
            <TextField name="times" type="time" label="Reminder time" defaultValue={Array.isArray(d.times) ? s(d.times[0]) : ""} />
            <CheckboxField name="remind" label="Remind me" defaultChecked={d.remind === true} />
          </FormRow>
          <p className="text-xs text-muted">Track only what your provider or pharmacist has suggested. This app never recommends medicines or doses.</p>
        </>
      )}
      {kind === "name" && (
        <FormRow>
          <SelectField name="list" label="As a" defaultValue={item?.list ?? list ?? "first"} options={[{ value: "first", label: "First name" }, { value: "middle", label: "Middle name" }, { value: "both", label: "Either" }]} />
          <SelectField name="sex" label="For" defaultValue={s(d.sex) || "any"} options={[{ value: "any", label: "Any baby" }, { value: "girl", label: "A girl" }, { value: "boy", label: "A boy" }]} />
        </FormRow>
      )}
      {(kind === "name" || kind === "checklist") && item && (
        <FormRow>
          {kind === "name" && <SelectField name="rating" label="Rating" defaultValue={s(item.rating)} placeholder="No rating" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) }))} />}
          {kind === "checklist" && <SelectField name="status" label="Status" defaultValue={item.status ?? "needed"} options={opts(ITEM_STATUSES)} />}
        </FormRow>
      )}
      <TextAreaField name="notes" label={kind === "name" ? "Meaning, notes" : kind === "question" ? "Answer / notes" : "Notes"} rows={2} defaultValue={item?.notes ?? ""} maxLength={2000} />
    </FormModal>
  );
}

// ─── Appointments ───────────────────────────────────────────────────────────

export type ApptDefaults = { id: string; kind: string; title: string; date: string; time: string; duration: number; provider: string | null; location: string | null; questions: string | null; tests: string | null; results: string | null; notes: string | null; followUpOn: string | null; reminderMinutes: number | null };

const REMINDERS = [
  { value: "", label: "No reminder" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "120", label: "2 hours before" },
  { value: "1440", label: "1 day before" },
  { value: "2880", label: "2 days before" },
  { value: "10080", label: "1 week before" },
];

export function AppointmentModal({ pregnancyId, now, item, openQuestions = [], defaultProvider, triggerContent, triggerClassName }: { pregnancyId: string; now: { date: string }; item?: ApptDefaults; openQuestions?: { id: string; title: string }[]; defaultProvider?: string | null; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal title={item ? "Edit appointment" : "Add an appointment"} triggerLabel="Add appointment" triggerContent={triggerContent} triggerClassName={triggerClassName} action={savePregnancyAppointment} submitLabel={item ? "Save" : "Add to calendar"}>
      <input type="hidden" name="pregnancyId" value={pregnancyId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <SelectField name="kind" label="Type" defaultValue={item?.kind ?? "prenatal"} options={APPOINTMENT_KINDS.map((k) => ({ value: k.value, label: `${k.emoji} ${k.label}` }))} />
        <TextField name="title" label="Title (optional)" defaultValue={item?.title ?? ""} placeholder="20-week anatomy scan" maxLength={120} />
      </FormRow>
      <FormRow cols={3}>
        <DateField name="date" label="Date" defaultValue={item?.date ?? now.date} required />
        <TextField name="time" type="time" label="Time" defaultValue={item?.time ?? "09:00"} />
        <NumberField name="duration" label="Minutes" min={5} max={600} defaultValue={item?.duration ?? 60} />
      </FormRow>
      <FormRow>
        <TextField name="provider" label="Provider" defaultValue={item?.provider ?? defaultProvider ?? ""} maxLength={120} />
        <TextField name="location" label="Location" defaultValue={item?.location ?? ""} maxLength={200} />
      </FormRow>
      <SelectField name="reminderMinutes" label="Reminder" defaultValue={item ? s(item.reminderMinutes) : "1440"} options={REMINDERS} />
      {openQuestions.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Questions to bring</legend>
          <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-xl border border-line p-2">
            {openQuestions.map((q) => (
              <label key={q.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="questionIds" value={q.id} className="mt-0.5 size-4" />
                {q.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <TextAreaField name="questions" label="Other things to ask or mention" rows={2} defaultValue={item?.questions ?? ""} maxLength={2000} />
      <FormRow>
        <TextAreaField name="tests" label="Tests planned" rows={2} defaultValue={item?.tests ?? ""} maxLength={1000} />
        <TextAreaField name="results" label="Results / what you learned" rows={2} defaultValue={item?.results ?? ""} maxLength={2000} />
      </FormRow>
      <FormRow>
        <DateField name="followUpOn" label="Follow-up by" defaultValue={item?.followUpOn ?? ""} />
        <TextField name="attachmentTitle" label="Attachment name" placeholder="Ultrasound report" maxLength={120} />
      </FormRow>
      <TextField name="attachment" type="file" label="Attach a file (image or PDF)" accept="image/*,application/pdf" />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} maxLength={4000} />
    </FormModal>
  );
}

// ─── Journal, photos, documents ─────────────────────────────────────────────

export type EntryDefaults = { id: string; kind: "journal" | "photo" | "document"; category: string | null; title: string | null; body: string | null; date: string; mood: string | null };

export function EntryModal({ pregnancyId, kind, now, item, triggerContent, triggerClassName, triggerLabel }: { pregnancyId: string; kind: "journal" | "photo" | "document"; now: { date: string }; item?: EntryDefaults; triggerContent?: ReactNode; triggerClassName?: string; triggerLabel?: string }) {
  const cats = kind === "journal" ? JOURNAL_CATEGORIES : kind === "photo" ? PHOTO_CATEGORIES : DOC_CATEGORIES;
  const label = { journal: item ? "Edit entry" : "Write in your journal", photo: item ? "Edit photo" : "Add a photo", document: item ? "Edit document" : "Add a document" }[kind];
  return (
    <FormModal title={label} triggerLabel={triggerLabel ?? label} triggerContent={triggerContent} triggerClassName={triggerClassName} action={savePregnancyEntry} refreshOnSuccess={kind !== "journal"}>
      <input type="hidden" name="pregnancyId" value={pregnancyId} />
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <DateField name="date" label="Date" defaultValue={item?.date ?? now.date} />
        <SelectField name="category" label="Type" defaultValue={item?.category ?? cats[0]!.value} options={cats} />
      </FormRow>
      <TextField name="title" label="Title" defaultValue={item?.title ?? ""} maxLength={160} />
      {kind !== "journal" && <TextField name="file" type="file" label={item ? "Replace file (optional)" : kind === "photo" ? "Photo" : "File (image or PDF)"} accept={kind === "photo" ? "image/*" : "image/*,application/pdf"} />}
      {kind === "journal" && (
        <SelectField name="mood" label="Feeling" defaultValue={item?.mood ?? ""} placeholder="—" options={["😊 Happy", "🥰 Excited", "😌 Calm", "😴 Tired", "😟 Worried", "😢 Emotional", "🤢 Unwell"].map((m) => ({ value: m, label: m }))} />
      )}
      <TextAreaField name="body" label={kind === "journal" ? "Write anything" : "Notes"} rows={kind === "journal" ? 6 : 2} defaultValue={item?.body ?? ""} maxLength={10000} />
      <p className="text-xs text-muted">The pregnancy week is added automatically from the date. Files are stored privately and only shown to people who can see this pregnancy.</p>
    </FormModal>
  );
}

// ─── Birth, reminders, birth plan ───────────────────────────────────────────

export function BirthModal({ pregnancyId, now, babyCount, babyName, isParent, canBaby, location }: { pregnancyId: string; now: { date: string; time: string }; babyCount: number; babyName?: string | null; isParent: boolean; canBaby: boolean; location?: string | null }) {
  return (
    <FormModal title="Baby is here!" triggerLabel="Baby is born" triggerIcon={<span aria-hidden>🎉</span>} action={recordBirth} submitLabel="Save birth details">
      <input type="hidden" name="id" value={pregnancyId} />
      <TextAreaField name="names" label={babyCount > 1 ? "Babies' names (one per line)" : "Baby's name"} rows={babyCount > 1 ? babyCount : 1} defaultValue={babyName ?? ""} maxLength={300} />
      <FormRow>
        <DateField name="date" label="Birth date" defaultValue={now.date} required />
        <TextField name="time" type="time" label="Time" />
      </FormRow>
      <TextField name="location" label="Where" defaultValue={location ?? ""} maxLength={200} />
      <FormRow>
        <TextField name="weight" label="Weight" placeholder="7 lb 4 oz or 3.3 kg" maxLength={40} />
        <TextField name="length" label="Length" placeholder="20 in or 51 cm" maxLength={40} />
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} maxLength={2000} />
      {isParent ? (
        <CheckboxField name="addToFamily" label="Add to our family" description={canBaby ? "Adds a family member and starts their Baby tracker with these birth details." : "Adds a family member (no login)."} defaultChecked />
      ) : (
        <p className="text-sm text-muted">A parent can add the baby to the family afterwards.</p>
      )}
      <p className="text-xs text-muted">Your pregnancy history stays here. You can view it any time.</p>
    </FormModal>
  );
}

export function RemindersForm({ pregnancyId, r }: { pregnancyId: string; r: { kicks?: string | null; hydration?: boolean; journal?: string | null; weekly?: boolean; prep?: boolean; questions?: boolean } }) {
  return (
    <ActionForm action={saveReminders} submitLabel="Save reminders" resetOnSuccess={false} showSuccess>
      <input type="hidden" name="id" value={pregnancyId} />
      <CheckboxField name="weekly" label="New week update" description="Each week: what's new for baby and you." defaultChecked={r.weekly ?? true} />
      <CheckboxField name="questions" label="Questions before appointments" description="The day before an appointment, if you have open questions." defaultChecked={r.questions ?? true} />
      <CheckboxField name="prep" label="Preparation nudges" description="When it's time for the hospital bag and other third-trimester lists." defaultChecked={r.prep ?? true} />
      <CheckboxField name="hydration" label="Water reminders" description="A gentle nudge late morning and mid-afternoon." defaultChecked={r.hydration ?? false} />
      <FormRow>
        <TextField name="kicks" type="time" label="Kick count reminder" defaultValue={r.kicks ?? ""} hint="Leave blank for none. Ask your provider when to start counting." />
        <TextField name="journal" type="time" label="Journal reminder" defaultValue={r.journal ?? ""} hint="Leave blank for none." />
      </FormRow>
      <p className="text-xs text-muted">Appointment reminders are set on each appointment. Medicine reminders are set on each medicine. Reminders go only to the person who&apos;s pregnant and anyone who can edit.</p>
    </ActionForm>
  );
}

export function BirthPlanForm({ pregnancyId, plan, readOnly }: { pregnancyId: string; plan: Record<string, string>; readOnly?: boolean }) {
  return (
    <ActionForm action={saveBirthPlan} submitLabel={readOnly ? undefined : "Save birth preferences"} resetOnSuccess={false} showSuccess>
      <input type="hidden" name="id" value={pregnancyId} />
      {BIRTH_PLAN_SECTIONS.map((sec) => (
        <TextAreaField key={sec.key} name={`bp_${sec.key}`} label={sec.label} hint={sec.hint} rows={3} defaultValue={plan[sec.key] ?? ""} maxLength={3000} disabled={readOnly} />
      ))}
    </ActionForm>
  );
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export function WeekContentForm({ week, base, override }: { week: number; base: WeekContent; override: Record<string, unknown> | null }) {
  const o = override ?? {};
  const dev = (o.development ?? {}) as Record<string, string>;
  const ln = (k: keyof WeekContent) => (Array.isArray(o[k]) ? (o[k] as string[]).join("\n") : "");
  const ph = (k: keyof WeekContent) => (Array.isArray(base[k]) ? (base[k] as string[]).join("\n") : String(base[k] ?? ""));
  return (
    <ActionForm action={saveWeekContent} submitLabel="Save week" resetOnSuccess={false} showSuccess footer={<button type="submit" name="reset" value="true" className="h-10 rounded-xl px-3 text-sm text-wine-600 hover:bg-wine-50">Reset to built-in</button>}>
      <input type="hidden" name="week" value={week} />
      <p className="text-sm text-muted">Leave a field blank to keep the built-in text (shown greyed out). Content is educational, not medical advice.</p>
      <FormRow cols={4}>
        <TextField name="size" label="Size" defaultValue={s(o.size)} placeholder={base.size} />
        <TextField name="emoji" label="Emoji" defaultValue={s(o.emoji)} placeholder={base.emoji} />
        <NumberField name="lengthCm" label="Length cm" defaultValue={s(o.lengthCm)} placeholder={s(base.lengthCm)} />
        <NumberField name="weightG" label="Weight g" defaultValue={s(o.weightG)} placeholder={s(base.weightG)} />
      </FormRow>
      <TextAreaField name="baby" label="Baby this week" rows={2} defaultValue={s(o.baby)} placeholder={base.baby} />
      <FormRow>
        <TextAreaField name="dev_body" label="Body" rows={2} defaultValue={s(dev.body)} placeholder={base.development.body} />
        <TextAreaField name="dev_organs" label="Organs" rows={2} defaultValue={s(dev.organs)} placeholder={base.development.organs} />
      </FormRow>
      <FormRow>
        <TextAreaField name="dev_movement" label="Movement" rows={2} defaultValue={s(dev.movement)} placeholder={base.development.movement} />
        <TextAreaField name="dev_senses" label="Senses" rows={2} defaultValue={s(dev.senses)} placeholder={base.development.senses} />
      </FormRow>
      <TextAreaField name="bodyChanges" label="Your body" rows={2} defaultValue={s(o.bodyChanges)} placeholder={base.bodyChanges} />
      {(["milestones", "symptoms", "care", "prepare", "questions"] as const).map((k) => (
        <TextAreaField key={k} name={k} label={`${k[0]!.toUpperCase()}${k.slice(1)} (one per line)`} rows={3} defaultValue={ln(k)} placeholder={ph(k)} />
      ))}
    </ActionForm>
  );
}

/** Checklist status picker that saves on change. */
export function StatusSelect({ id, value, disabled }: { id: string; value: string; disabled?: boolean }) {
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Status"
      value={v}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        const fd = new FormData();
        fd.set("id", id);
        fd.set("status", next);
        start(() => runVoid(updatePregnancyItem, fd));
      }}
      className={cn("h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm", (v === "complete" || v === "packed" || v === "purchased") && "border-olive-300 bg-olive-50 text-olive-700")}
    >
      {ITEM_STATUSES.map((st) => (
        <option key={st.value} value={st.value}>
          {st.label}
        </option>
      ))}
    </select>
  );
}
