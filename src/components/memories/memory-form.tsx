import { Pencil, Plus } from "lucide-react";
import { saveMemory } from "@/app/actions/memories";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, MemberChips, PhotosField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";
import { Field } from "@/components/ui/form";

export type MemoryDefaults = { id: string; title: string; body: string | null; date: string; milestone: boolean; memberIds: string[]; place: string | null; private: boolean };

/** Add or edit a memory: what happened, when, who, and photos. */
export function MemoryModal({ members, today, item, milestone, label }: { members: MemberOption[]; today: string; item?: MemoryDefaults; milestone?: boolean; label?: string }) {
  return (
    <FormModal
      title={item ? "Edit memory" : milestone ? "Add a milestone" : "Add a memory"}
      triggerLabel={label ?? (milestone ? "Add milestone" : "Add memory")}
      triggerIcon={item ? undefined : <Plus className="size-4" />}
      triggerContent={item ? <Pencil className="mx-auto size-4" /> : undefined}
      triggerAriaLabel={item ? "Edit memory" : undefined}
      triggerClassName={item ? "size-9 rounded-full text-muted hover:bg-sunken" : undefined}
      triggerVariant={milestone ? "secondary" : "primary"}
      action={saveMemory}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="title" label="What happened" required maxLength={160} defaultValue={item?.title} placeholder={milestone ? "Lily's first steps" : "Pancake Saturday at the lake"} />
        <DateField name="date" label="When" required defaultValue={item?.date ?? today} />
      </FormRow>
      <TextAreaField name="body" label="The story" rows={4} defaultValue={item?.body ?? ""} placeholder="What made it special, funny things people said…" />
      <TextField name="place" label="Where (optional)" maxLength={160} defaultValue={item?.place ?? ""} />
      <Field label="Who">
        <MemberChips name="people" members={members} defaultValue={item?.memberIds ?? []} />
      </Field>
      <PhotosField name="photos" label={item ? "Add more photos" : "Photos"} max={30} />
      <CheckboxField name="milestone" label="Milestone" description="A big moment (first steps, first day of school, graduation). Shown with a ⭐ on the timeline." defaultChecked={item ? item.milestone : milestone} />
      <CheckboxField name="private" label="Only me" description="Keep this memory private to you." defaultChecked={item?.private} />
    </FormModal>
  );
}
