"use client";

import { useState, type ReactNode } from "react";
import { saveCheckIn, saveQuoteNote, saveSleepEntry, saveSleepSettings, saveWellnessEntry, saveWellnessGoal, saveWellnessSettings } from "@/app/actions/wellness";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import { ChipSelect, DateField, FormRow, NumberField, PhotosField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { QUOTE_CATEGORIES } from "@/lib/quotes";
import { cn } from "@/lib/utils";
import { FEELINGS, GOAL_KINDS, INTENSITIES, MOODS, SELF_CARE } from "@/lib/wellness";
import { DAILY_QUESTIONS, GUIDED_PROMPTS, SCALES, type ScaleKey } from "@/lib/wellness-insights";
import { DictateButton, VoiceRecorder } from "./voice";

const chips = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

function MoodPicker({ defaultValue }: { defaultValue?: string | null }) {
  const [v, setV] = useState(defaultValue ?? "");
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-soft">How are you feeling today?</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {MOODS.map((m) => (
          <label key={m.key} className={cn("relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-medium", v === m.key ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}>
            <input type="radio" name="mood" value={m.key} checked={v === m.key} onChange={() => setV(m.key)} className="sr-only" />
            <span className="text-2xl" aria-hidden>
              {m.emoji}
            </span>
            {m.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function IntensityPicker({ defaultValue }: { defaultValue?: string | null }) {
  const [v, setV] = useState(defaultValue ?? "");
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-soft">How strong? (optional)</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {INTENSITIES.map((i) => (
          <label key={i.key} className={cn("relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-sm", v === i.key ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}>
            <input type="radio" name="intensity" value={i.key} checked={v === i.key} onChange={() => setV(i.key)} onClick={() => v === i.key && setV("")} className="sr-only" />
            {i.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export type CheckInDefaults = {
  mood: string | null;
  feelings: string[];
  intensity: string | null;
  selfCare: string[];
  note: string | null;
  shared: boolean;
  energy?: number | null;
  stress?: number | null;
  sleepQuality?: number | null;
  answers?: Record<string, boolean>;
};

/** A 1–5 scale with words, not just numbers or colours. Tap again to clear. */
function ScalePicker({ k, defaultValue, name }: { k: ScaleKey; defaultValue?: number | null; name?: string }) {
  const [v, setV] = useState(defaultValue ?? 0);
  const s = SCALES[k];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-soft">{s.question} (optional)</legend>
      <input type="hidden" name={name ?? k} value={v || ""} />
      <div className="grid grid-cols-5 gap-1">
        {s.options.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={v === i + 1}
            onClick={() => setV(v === i + 1 ? 0 : i + 1)}
            className={cn("flex min-h-12 flex-col items-center justify-center rounded-xl border px-0.5 text-center text-[11px] leading-tight sm:text-xs", v === i + 1 ? "border-primary-500 bg-primary-50 font-semibold text-primary-700" : "border-line-strong hover:bg-sunken")}
          >
            <span className="text-sm font-semibold tabular-nums" aria-hidden>
              {i + 1}
            </span>
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Simple yes/no daily questions. Unanswered is fine. */
function DailyQuestions({ defaults }: { defaults?: Record<string, boolean> }) {
  const [a, setA] = useState<Record<string, boolean | undefined>>(defaults ?? {});
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-soft">A few quick questions (optional)</legend>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {DAILY_QUESTIONS.map((q) => (
          <li key={q.key} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="text-sm">{q.q}</span>
            <input type="hidden" name={`q_${q.key}`} value={a[q.key] === undefined ? "" : a[q.key] ? "yes" : "no"} />
            <span className="flex shrink-0 gap-1" role="group" aria-label={q.q}>
              {(["yes", "no"] as const).map((x) => {
                const on = a[q.key] === (x === "yes");
                return (
                  <button key={x} type="button" aria-pressed={on} onClick={() => setA((s) => ({ ...s, [q.key]: on ? undefined : x === "yes" }))} className={cn("h-9 min-w-12 rounded-full border px-3 text-sm capitalize", on ? "border-primary-500 bg-primary-50 font-semibold text-primary-700" : "border-line-strong hover:bg-sunken")}>
                    {x}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** A few taps: mood, feelings, how strong, self-care, an optional note. */
export function CheckInForm({ memberId, defaults, customFeelings, customSelfCare, shareWith }: { memberId: string; defaults?: CheckInDefaults; customFeelings: string[]; customSelfCare: string[]; shareWith: string | null }) {
  return (
    <ActionForm action={saveCheckIn} submitLabel={defaults ? "Update check-in" : "Check in"} resetOnSuccess={false} showSuccess>
      <input type="hidden" name="memberId" value={memberId} />
      <MoodPicker defaultValue={defaults?.mood} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Feelings (pick any)</legend>
        <ChipSelect name="feelings" options={chips([...new Set([...FEELINGS, ...customFeelings, ...(defaults?.feelings ?? [])])])} defaultValue={defaults?.feelings ?? []} />
      </fieldset>
      <IntensityPicker defaultValue={defaults?.intensity} />
      <ScalePicker k="energy" defaultValue={defaults?.energy} />
      <ScalePicker k="stress" defaultValue={defaults?.stress} />
      <ScalePicker k="sleepQuality" defaultValue={defaults?.sleepQuality} />
      <DailyQuestions defaults={defaults?.answers} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Self-care today (optional)</legend>
        <ChipSelect name="selfCare" options={[...SELF_CARE.map((s) => ({ value: s.key, label: s.label })), ...customSelfCare.map((x) => ({ value: x, label: x }))]} defaultValue={defaults?.selfCare ?? []} />
      </fieldset>
      <TextAreaField name="note" label="Anything else? (optional)" rows={2} defaultValue={defaults?.note ?? ""} />
      {shareWith ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="hidden" name="shared" value="false" />
          <input type="checkbox" name="shared" value="true" defaultChecked={defaults?.shared} className="mt-0.5 size-4 accent-[var(--color-primary-600)]" />
          <span>
            Share today&apos;s mood with {shareWith}
            <span className="block text-xs text-muted">Only your mood, feelings and self-care. Your journal stays private.</span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-muted">Your check-ins are private. To share a mood, choose who in the Privacy Center first.</p>
      )}
    </ActionForm>
  );
}

export type EntryDefaults = { id: string; date: string; title: string | null; body: string; mood: string | null; tags: string[]; feelings: string[]; intensity: string | null; gratitude: string[]; accomplishments: string | null; challenges: string | null; selfCare: string[]; prompt: string | null; shared: boolean };

/** Wellness journal entry. Every box is optional; prompts can be skipped. */
export function WellnessEntryModal({ today, prompt, defaults, shareWith, triggerLabel = "Write", triggerContent, customFeelings, customSelfCare, defaultOpen }: { today: string; prompt?: string | null; defaults?: EntryDefaults; shareWith: string | null; triggerLabel?: string; triggerContent?: ReactNode; customFeelings: string[]; customSelfCare: string[]; defaultOpen?: boolean }) {
  const [p, setP] = useState<string | null>(defaults?.prompt ?? prompt ?? null);
  return (
    <FormModal title={defaults ? "Edit entry" : "Wellness journal"} triggerLabel={triggerLabel} triggerContent={triggerContent} action={saveWellnessEntry} submitLabel={defaults ? "Save" : "Save entry"} size="lg" defaultOpen={defaultOpen}>
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      {p && <input type="hidden" name="prompt" value={p} />}
      <FormRow>
        <DateField name="date" label="Date" defaultValue={defaults?.date ?? today} />
        <TextField name="title" label="Title (optional)" defaultValue={defaults?.title ?? ""} />
      </FormRow>
      <MoodPicker defaultValue={defaults?.mood} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Feelings (optional)</legend>
        <ChipSelect name="feelings" options={chips([...new Set([...FEELINGS, ...customFeelings, ...(defaults?.feelings ?? [])])])} defaultValue={defaults?.feelings ?? []} />
      </fieldset>
      <IntensityPicker defaultValue={defaults?.intensity} />
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
        Need a prompt? (optional)
        <select value={p ?? ""} onChange={(e) => setP(e.target.value || null)} className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] font-normal">
          <option value="">No prompt, just write</option>
          {p && !GUIDED_PROMPTS.some((g) => g.prompts.includes(p)) && <option value={p}>{p}</option>}
          {GUIDED_PROMPTS.map((g) => (
            <optgroup key={g.theme} label={g.theme}>
              {g.prompts.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <TextAreaField name="body" label={p ?? "What's on your mind?"} rows={5} defaultValue={defaults?.body ?? ""} hint={p ? "Skip the prompt and write anything you like." : undefined} />
      <DictateButton target="body" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink-soft">Grateful for (optional)</legend>
        {[0, 1, 2].map((i) => (
          <input key={i} name="gratitude" defaultValue={defaults?.gratitude[i] ?? ""} placeholder={["One thing…", "Another…", "And one more…"][i]} aria-label={`Gratitude ${i + 1}`} className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]" />
        ))}
      </fieldset>
      <FormRow>
        <TextAreaField name="accomplishments" label="Something I accomplished (optional)" rows={2} defaultValue={defaults?.accomplishments ?? ""} />
        <TextAreaField name="challenges" label="Something that was hard (optional)" rows={2} defaultValue={defaults?.challenges ?? ""} />
      </FormRow>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Self-care (optional)</legend>
        <ChipSelect name="selfCare" options={[...SELF_CARE.map((s) => ({ value: s.key, label: s.label })), ...customSelfCare.map((x) => ({ value: x, label: x }))]} defaultValue={defaults?.selfCare ?? []} />
      </fieldset>
      <TextField name="tags" label="Tags (optional)" defaultValue={defaults?.tags.join(", ") ?? ""} hint="Comma separated" />
      <PhotosField name="photos" label="Photos (optional)" />
      <VoiceRecorder />
      {shareWith ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="share" defaultChecked={defaults?.shared} className="mt-0.5 size-4 accent-[var(--color-primary-600)]" />
          <span>
            Share this entry with {shareWith}
            <span className="block text-xs text-muted">Off = only you can read it.</span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-muted">Private: only you can read your wellness journal.</p>
      )}
    </FormModal>
  );
}

export function WellnessGoalModal({ memberId, defaults, triggerLabel = "Add goal", triggerContent }: { memberId: string; defaults?: { id?: string; title: string; kind: string; timesPerWeek: number; selfCareKey: string | null; cadence?: string; reminderTime?: string | null }; triggerLabel?: string; triggerContent?: ReactNode }) {
  const [kind, setKind] = useState(defaults?.kind ?? "journal");
  return (
    <FormModal title={defaults?.id ? "Edit goal" : "A gentle goal"} triggerLabel={triggerLabel} triggerVariant={defaults && !defaults.id ? "secondary" : undefined} triggerSize={defaults && !defaults.id ? "sm" : undefined} triggerContent={triggerContent} action={saveWellnessGoal} size="sm">
      <input type="hidden" name="memberId" value={memberId} />
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      <TextField name="title" label="Goal" required defaultValue={defaults?.title} placeholder="Journal 3 times this week" />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
        What counts
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]">
          {GOAL_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {kind === "self_care" && <SelectField name="selfCareKey" label="Which activity" defaultValue={defaults?.selfCareKey ?? "outside"} options={SELF_CARE.map((s) => ({ value: s.key, label: s.label }))} />}
      <SelectField name="cadence" label="How often" defaultValue={defaults?.cadence ?? "weekly"} options={[{ value: "weekly", label: "Some days each week" }, { value: "daily", label: "Every day" }]} />
      <NumberField name="timesPerWeek" label="Times per week (for weekly goals)" min={1} max={7} defaultValue={defaults?.timesPerWeek ?? 3} hint="Aim, not a rule. Any progress counts." />
      <TextField name="reminderTime" type="time" label="Reminder (optional)" defaultValue={defaults?.reminderTime?.slice(0, 5) ?? ""} hint="Only sent on days it isn't done yet." />
    </FormModal>
  );
}

export function QuoteNoteForm({ quoteId, note }: { quoteId: string; note: string | null }) {
  return (
    <ActionForm action={saveQuoteNote} submitLabel="Save note" resetOnSuccess={false} showSuccess className="gap-2">
      <input type="hidden" name="quoteId" value={quoteId} />
      <TextAreaField name="note" label="My note (optional)" rows={2} defaultValue={note ?? ""} />
    </ActionForm>
  );
}

type Freq = "off" | "daily" | "weekdays" | "weekly";
export function WellnessSettingsForm({ reminders, customFeelings, customSelfCare, quoteCategories }: { reminders: Partial<Record<string, Freq>>; customFeelings: string[]; customSelfCare: string[]; quoteCategories: string[] }) {
  const rows = [
    ["checkIn", "Daily check-in"],
    ["journal", "Journal"],
    ["gratitude", "Gratitude"],
    ["selfCare", "Self-care"],
    ["goals", "Wellness goals"],
  ] as const;
  return (
    <ActionForm action={saveWellnessSettings} submitLabel="Save settings" resetOnSuccess={false} showSuccess>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-ink-soft">Gentle reminders</legend>
        {rows.map(([k, label]) => (
          <label key={k} className="flex items-center justify-between gap-3 border-b border-line/70 py-2 text-[15px]">
            {label}
            <select name={`reminder_${k}`} defaultValue={reminders[k] ?? "off"} className="h-10 rounded-lg border border-line-strong bg-surface px-2 text-sm">
              <option value="off">Off</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Once a week (Monday)</option>
            </select>
          </label>
        ))}
        <p className="text-xs text-muted">Reminders are friendly nudges like “Ready for today&apos;s check-in?”. Skipping a day is always fine.</p>
      </fieldset>
      <TextField name="customFeelings" label="My own feelings" defaultValue={customFeelings.join(", ")} hint="Comma separated" />
      <TextField name="customSelfCare" label="My own self-care activities" defaultValue={customSelfCare.join(", ")} hint="Comma separated" />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Daily quote topics (none = all)</legend>
        <ChipSelect name="quoteCategories" options={chips([...QUOTE_CATEGORIES])} defaultValue={quoteCategories} />
      </fieldset>
    </ActionForm>
  );
}

export type SleepDefaults = { id?: string; date: string; bedTime: string | null; wakeTime: string | null; quality: number | null; awakenings: number | null; notes: string | null };

function SleepFields({ d }: { d: SleepDefaults }) {
  return (
    <>
      <FormRow cols={3}>
        <DateField name="date" label="Morning of" defaultValue={d.date} />
        <TextField name="bedTime" type="time" label="Went to bed" defaultValue={d.bedTime?.slice(0, 5) ?? ""} />
        <TextField name="wakeTime" type="time" label="Woke up" defaultValue={d.wakeTime?.slice(0, 5) ?? ""} />
      </FormRow>
      <ScalePicker k="sleepQuality" name="quality" defaultValue={d.quality} />
      <FormRow>
        <NumberField name="awakenings" label="Times you woke up" min={0} max={30} defaultValue={d.awakenings ?? ""} />
        <TextField name="notes" label="Notes" defaultValue={d.notes ?? ""} placeholder="Dreams, noise, late coffee…" />
      </FormRow>
    </>
  );
}

/** Log last night right on the page. */
export function SleepForm({ d }: { d: SleepDefaults }) {
  return (
    <ActionForm action={saveSleepEntry} submitLabel="Save night" resetOnSuccess={false} showSuccess>
      <SleepFields d={d} />
    </ActionForm>
  );
}

export function SleepModal({ d, triggerContent }: { d: SleepDefaults; triggerContent?: ReactNode }) {
  return (
    <FormModal title="Edit night" triggerLabel="Edit" triggerContent={triggerContent} triggerClassName="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken" action={saveSleepEntry} size="sm">
      <SleepFields d={d} />
    </FormModal>
  );
}

export function SleepSettingsForm({ bedtimeReminder, sleepGoalHours }: { bedtimeReminder: string | null; sleepGoalHours: string }) {
  return (
    <ActionForm action={saveSleepSettings} submitLabel="Save" resetOnSuccess={false} showSuccess>
      <FormRow>
        <TextField name="bedtimeReminder" type="time" label="Bedtime reminder" defaultValue={bedtimeReminder?.slice(0, 5) ?? ""} hint="Leave empty for no reminder." />
        <NumberField name="sleepGoalHours" label="Sleep goal (hours)" min={4} max={14} step="0.5" defaultValue={sleepGoalHours} />
      </FormRow>
    </ActionForm>
  );
}
