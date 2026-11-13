import { CalendarPlus, Pencil } from "lucide-react";
import { saveMedicalAppointment } from "@/app/actions/medical";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, MemberSelect, NumberField, SelectField, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";

export type ApptDefaults = { id?: string; title?: string; memberId?: string; date?: string; time?: string; duration?: number; location?: string | null; description?: string | null; notes?: string | null; reminderMinutes?: number | null; visibility?: "family" | "selected"; selected?: string[] };

export function AppointmentModal({ members, d = {}, edit }: { members: MemberOption[]; d?: ApptDefaults; edit?: boolean }) {
  return (
    <FormModal
      title={edit ? "Edit appointment" : "Schedule appointment"}
      action={saveMedicalAppointment}
      size="lg"
      submitLabel={edit ? "Save" : "Schedule"}
      triggerVariant={edit ? undefined : "secondary"}
      triggerIcon={<CalendarPlus className="size-4" />}
      triggerLabel="Appointment"
      triggerContent={edit ? <Pencil className="mx-auto size-4" /> : undefined}
      triggerAriaLabel={edit ? "Edit appointment" : undefined}
      triggerClassName={edit ? "size-9 rounded-full text-muted hover:bg-sunken" : undefined}
      description="Added to the family calendar. Private to the patient and parents unless you share it."
    >
      {d.id && <input type="hidden" name="id" value={d.id} />}
      <TextField name="title" label="Appointment" defaultValue={d.title} placeholder="Annual physical" required />
      <MemberSelect name="memberId" label="Patient" members={members} defaultValue={d.memberId ?? null} placeholder="Choose…" />
      <FormRow cols={3}>
        <DateField name="date" label="Date" defaultValue={d.date} required />
        <TextField name="time" label="Time" type="time" defaultValue={d.time ?? "09:00"} />
        <NumberField name="duration" label="Minutes" defaultValue={d.duration ?? 60} min={5} max={600} />
      </FormRow>
      <TextField name="location" label="Provider / location" defaultValue={d.location ?? ""} placeholder="Valley Family Medicine" />
      <SelectField
        name="reminderMinutes"
        label="Reminder"
        defaultValue={String(d.reminderMinutes ?? 1440)}
        options={[
          { value: "60", label: "1 hour before" },
          { value: "1440", label: "1 day before" },
          { value: "2880", label: "2 days before" },
          { value: "10080", label: "1 week before" },
        ]}
      />
      <TextAreaField name="description" label="Reason / questions to ask" rows={2} defaultValue={d.description ?? ""} />
      <TextAreaField name="notes" label="Notes after the visit" rows={2} defaultValue={d.notes ?? ""} />
      <VisibilityField members={members} defaultValue={d.visibility === "family" ? "family" : d.selected?.length ? "selected" : "private"} defaultSelected={d.selected} privateLabel="Patient & parents" />
    </FormModal>
  );
}
