import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarHeart, Pencil, Plus } from "lucide-react";
import { deleteFamilyDate, saveFamilyDate } from "@/app/actions/memories";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, MemberChips, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { MemoriesTabs } from "@/components/memories/tabs";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/form";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { ordinal, specialDates, type SpecialDate } from "@/lib/memories";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Birthdays & anniversaries" };

const KINDS = [
  { value: "anniversary", label: "Anniversary" },
  { value: "birthday", label: "Birthday (not in the family)" },
  { value: "other", label: "Other yearly date" },
];
const REMIND = [0, 1, 3, 7, 14, 30].map((d) => ({ value: String(d), label: d === 0 ? "On the day" : `${d} day${d === 1 ? "" : "s"} before (and on the day)` }));
const emoji = (d: SpecialDate) => (d.kind === "birthday" ? "🎂" : d.kind === "anniversary" ? "💍" : "📅");
const when = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", timeZone: "UTC" });

export default async function DatesPage() {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const today = todayIn(viewer.family.timezone);
  const [list, members] = await Promise.all([specialDates(viewer, today), memberOptions(viewer)]);
  const canUse = viewer.can("photos", "use");
  const form = (d?: SpecialDate & { month?: number }) => (
    <>
      {d?.id && <input type="hidden" name="id" value={d.id} />}
      <FormRow>
        <TextField name="title" label="Occasion" required maxLength={120} defaultValue={d?.title} placeholder="Mom & Dad's wedding anniversary" />
        <SelectField name="kind" label="Type" defaultValue={d?.kind ?? "anniversary"} options={KINDS} />
      </FormRow>
      <FormRow>
        <DateField name="date" label="Date (the original year, if you know it)" required defaultValue={d ? `${d.years !== null ? Number(d.date.slice(0, 4)) - d.years : d.date.slice(0, 4)}${d.date.slice(4)}` : undefined} />
        <SelectField name="remindDays" label="Remind everyone" defaultValue={String(d?.remindDays ?? 7)} options={REMIND} />
      </FormRow>
      <CheckboxField name="yearUnknown" label="I don't know the year" defaultChecked={!!d && d.years === null} />
      <Field label="Who it's about (optional)">
        <MemberChips name="people" members={members} defaultValue={d?.memberIds ?? []} />
      </Field>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={d?.notes ?? ""} placeholder="Gift ideas, how we usually celebrate…" />
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Memories"
        title="Birthdays & anniversaries"
        description="Every birthday and anniversary coming up, with how old or how many years. They're on the family calendar too, with reminders."
        actions={
          canUse ? (
            <FormModal title="Add an anniversary or date" triggerLabel="Add a date" triggerIcon={<Plus className="size-4" />} action={saveFamilyDate}>
              {form()}
            </FormModal>
          ) : undefined
        }
      />
      <MemoriesTabs active="dates" />
      <p className="mb-4 text-sm text-muted">
        Birthdays come from each family member&apos;s profile (Family → the person) and from <Link href="/contacts" className="text-primary-700 underline">Contacts</Link>.
      </p>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarHeart />} title="No dates yet" description="Add birthdays to family profiles, and anniversaries here." />
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((d) => (
            <li key={d.key}>
              <Card className={cn("flex items-center gap-3", d.daysAway === 0 && "border-primary-300 bg-primary-50")}>
                <span className="text-3xl" aria-hidden>
                  {emoji(d)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.title}</p>
                  <p className="text-sm text-muted">
                    {when(d.date)}
                    {d.years !== null && d.years > 0 && ` · ${d.kind === "birthday" ? `turns ${d.years}` : `${ordinal(d.years)}`}`}
                  </p>
                  {d.notes && <p className="text-xs text-muted">{d.notes}</p>}
                </div>
                <div className="shrink-0 text-right">
                  {d.daysAway === 0 ? <Badge tone="primary">Today! 🎉</Badge> : <p className="text-sm font-semibold tabular-nums">{d.daysAway === 1 ? "Tomorrow" : `${d.daysAway} days`}</p>}
                  {d.editable && (
                    <span className="mt-1 flex justify-end">
                      <FormModal title="Edit date" triggerContent={<Pencil className="mx-auto size-4" />} triggerAriaLabel={`Edit ${d.title}`} triggerClassName="size-8 rounded-full text-muted hover:bg-sunken" action={saveFamilyDate}>
                        {form(d)}
                      </FormModal>
                      <DeleteButton action={deleteFamilyDate} fields={{ id: d.id }} what={d.title} />
                    </span>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
