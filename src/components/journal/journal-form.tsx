"use client";

import { useState, type ReactNode } from "react";
import { saveJournalEntry } from "@/app/actions/journal";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, PhotosField, MemberChips, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const MOODS = [
  { key: "happy", emoji: "😊", label: "Happy" },
  { key: "calm", emoji: "😌", label: "Calm" },
  { key: "grateful", emoji: "🙏", label: "Grateful" },
  { key: "excited", emoji: "🥳", label: "Excited" },
  { key: "tired", emoji: "😴", label: "Tired" },
  { key: "sad", emoji: "😔", label: "Sad" },
  { key: "frustrated", emoji: "😤", label: "Frustrated" },
  { key: "sick", emoji: "🤒", label: "Under the weather" },
];

export type JournalDefaults = { id: string; date: string; title: string | null; body: string; mood: string | null; tags: string[]; people: string[]; visibility: "family" | "private" | "selected" | "parents"; sharedWith: string[] };

function MoodPicker({ defaultValue }: { defaultValue?: string | null }) {
  const [mood, setMood] = useState(defaultValue ?? "");
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Mood">
      <input type="hidden" name="mood" value={mood} />
      {MOODS.map((m) => (
        <button
          key={m.key}
          type="button"
          role="radio"
          aria-checked={mood === m.key}
          title={m.label}
          onClick={() => setMood(mood === m.key ? "" : m.key)}
          className={cn("flex size-11 items-center justify-center rounded-full text-2xl transition-transform", mood === m.key ? "scale-110 bg-primary-100 ring-2 ring-primary-400" : "bg-sunken hover:scale-105")}
        >
          <span aria-hidden>{m.emoji}</span>
          <span className="sr-only">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function JournalFormModal({ members, today, defaults, defaultOpen, triggerContent, triggerLabel = "New entry", initialVisibility }: { members: MemberOption[]; today: string; defaults?: JournalDefaults; defaultOpen?: boolean; triggerContent?: ReactNode; triggerLabel?: string; initialVisibility?: { visibility: "private" | "parents" | "selected"; sharedWith: string[] } }) {
  return (
    <FormModal
      title={defaults ? "Edit entry" : "New journal entry"}
      triggerLabel={triggerLabel}
      action={saveJournalEntry}
      submitLabel={defaults ? "Save" : "Save entry"}
      size="lg"
      defaultOpen={defaultOpen}
      triggerContent={triggerContent}
      triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
    >
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <FormRow>
        <DateField name="date" label="Date" defaultValue={defaults?.date ?? today} />
        <TextField name="title" label="Title (optional)" defaultValue={defaults?.title ?? ""} placeholder="First snow of the year" />
      </FormRow>
      <Field label="How are you feeling?">
        <MoodPicker defaultValue={defaults?.mood} />
      </Field>
      <TextAreaField name="body" label="Entry" rows={8} required defaultValue={defaults?.body} placeholder="What happened today? What do you want to remember?" />
      <PhotosField name="photos" label="Photos" />
      <TextField name="tags" label="Tags" defaultValue={defaults?.tags.join(", ") ?? ""} placeholder="holidays, garden, firsts" hint="Comma separated" />
      <Field label="Who's in this memory">
        <MemberChips name="people" members={members} defaultValue={defaults?.people} />
      </Field>
      <VisibilityField members={members} defaultValue={defaults?.visibility ?? initialVisibility?.visibility ?? "private"} defaultSelected={defaults?.sharedWith ?? initialVisibility?.sharedWith} privateLabel="Only me" />
    </FormModal>
  );
}
