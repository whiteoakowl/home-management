"use client";

import { useState, type ReactNode } from "react";
import { saveCheckIn, saveQuoteNote, saveWellnessEntry, saveWellnessGoal, saveWellnessSettings } from "@/app/actions/wellness";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import { ChipSelect, DateField, FormRow, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { QUOTE_CATEGORIES } from "@/lib/quotes";
import { cn } from "@/lib/utils";
import { FEELINGS, GOAL_KINDS, INTENSITIES, MOODS, SELF_CARE } from "@/lib/wellness";

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

export type CheckInDefaults = { mood: string | null; feelings: string[]; intensity: string | null; selfCare: string[]; note: string | null; shared: boolean };

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
  const p = defaults?.prompt ?? prompt ?? null;
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
      <TextAreaField name="body" label={p ?? "What's on your mind?"} rows={5} defaultValue={defaults?.body ?? ""} hint={p ? "Skip the prompt and write anything you like." : undefined} />
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
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
        Photos (optional)
        <input type="file" name="photos" accept="image/*" multiple className="text-sm" />
      </label>
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

export function WellnessGoalModal({ memberId, defaults, triggerLabel = "Add goal", triggerContent }: { memberId: string; defaults?: { id: string; title: string; kind: string; timesPerWeek: number; selfCareKey: string | null }; triggerLabel?: string; triggerContent?: ReactNode }) {
  const [kind, setKind] = useState(defaults?.kind ?? "journal");
  return (
    <FormModal title={defaults ? "Edit goal" : "A gentle goal"} triggerLabel={triggerLabel} triggerContent={triggerContent} action={saveWellnessGoal} size="sm">
      <input type="hidden" name="memberId" value={memberId} />
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
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
      <NumberField name="timesPerWeek" label="Times per week" min={1} max={7} defaultValue={defaults?.timesPerWeek ?? 3} hint="Aim, not a rule. Any progress counts." />
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
