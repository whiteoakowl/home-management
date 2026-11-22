import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, CalendarPlus, LayoutTemplate, Pencil, Plus } from "lucide-react";
import { db } from "@/db";
import { categories, eventTemplates } from "@/db/schema";
import { deleteEventTemplate, saveEventTemplate, useEventTemplate } from "@/app/actions/event-templates";
import { REMINDER_OPTIONS } from "@/lib/reminders";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, MemberChips, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/form";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Event templates" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${m / 60} hr`.replace(".5 hr", "½ hr") }));
const time12 = (t: string) => new Date(`2000-01-01T${t}:00Z`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const iconBtn = "size-9 rounded-full text-muted hover:bg-sunken";

type T = typeof eventTemplates.$inferSelect;

function TemplateFields({ t, members, cats, me }: { t?: T; members: Awaited<ReturnType<typeof memberOptions>>; cats: { id: string; name: string }[]; me: string }) {
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <FormRow>
        <TextField name="name" label="Template name" required maxLength={80} defaultValue={t?.name} placeholder="Jack's soccer practice" />
        <TextField name="title" label="Event title (optional)" maxLength={120} defaultValue={t?.title !== t?.name ? t?.title : ""} placeholder="Soccer practice" />
      </FormRow>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-soft">Repeats every (leave empty for a one-time event)</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <label key={d} className="inline-flex h-10 w-12 cursor-pointer items-center justify-center rounded-full border border-line text-sm font-medium has-[:checked]:border-primary-500 has-[:checked]:bg-primary-600 has-[:checked]:text-white">
              <input type="checkbox" name="weekday" value={i} defaultChecked={t?.weekdays.includes(i)} className="sr-only" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <FormRow cols={3}>
        <TextField name="startTime" label="Time" type="time" defaultValue={t?.startTime ?? "17:30"} />
        <SelectField name="durationMin" label="How long" defaultValue={String(t?.durationMin ?? 60)} options={DURATIONS} />
        <SelectField name="reminderMinutes" label="Reminder" defaultValue={t?.reminderMinutes?.toString() ?? "60"} placeholder="None" options={REMINDER_OPTIONS} />
      </FormRow>
      <CheckboxField name="allDay" label="All day (no time)" defaultChecked={!!t && !t.startTime} />
      <FormRow>
        <TextField name="location" label="Location" maxLength={200} defaultValue={t?.location ?? ""} placeholder="Riverside Park, Field 3" />
        <SelectField name="categoryId" label="Category" defaultValue={t?.categoryId ?? ""} placeholder="None" options={cats.map((c) => ({ value: c.id, label: c.name }))} />
      </FormRow>
      <Field label="Who">
        <MemberChips name="attendees" members={members} defaultValue={t?.memberIds ?? [me]} />
      </Field>
      <TextAreaField name="description" label="Notes on each event" rows={2} defaultValue={t?.description ?? ""} placeholder="Bring water bottle and shin guards" />
    </>
  );
}

export default async function TemplatesPage() {
  const viewer = await getViewer();
  if (!viewer.can("calendar")) notFound();
  const canUse = viewer.can("calendar", "use");
  const [rows, members, cats] = await Promise.all([
    db.select().from(eventTemplates).where(eq(eventTemplates.familyId, viewer.family.id)).orderBy(asc(eventTemplates.name)),
    memberOptions(viewer),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.familyId, viewer.family.id), eq(categories.domain, "calendar"))).orderBy(asc(categories.sortOrder)),
  ]);
  const today = todayIn(viewer.family.timezone);
  const who = (ids: string[]) => ids.map((id) => members.find((m) => m.id === id)?.displayName.split(" ")[0]).filter(Boolean).join(", ");
  const add = (
    <FormModal title="New event template" triggerLabel="New template" triggerIcon={<Plus className="size-4" />} action={saveEventTemplate}>
      <TemplateFields members={members} cats={cats} me={viewer.member.id} />
    </FormModal>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft className="size-4" /> Calendar
      </Link>
      <PageHeader help="event-templates" eyebrow="Calendar" title="Event templates" description="Set up a regular activity once (day, time, place, who, reminder), then add it to the calendar for the whole season in one tap." actions={canUse ? add : undefined} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<LayoutTemplate />} title="No templates yet" description="Great for practices, lessons, carpools, church and anything that happens every week." example="Soccer practice · Tuesdays 5:30 PM · Field 3 · Jack · remind 1 hour before" action={canUse ? add : undefined} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((t) => {
            const days = t.weekdays.length === 7 ? "Every day" : t.weekdays.length ? t.weekdays.map((d) => (t.weekdays.length === 1 ? DAY_NAMES[d] : DAYS[d])).join(", ") : "One time";
            const reminder = REMINDER_OPTIONS.find((o) => o.value === String(t.reminderMinutes))?.label;
            return (
              <li key={t.id}>
                <Card className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-muted">
                      {[days, t.startTime ? `${time12(t.startTime)} · ${t.durationMin < 60 ? `${t.durationMin} min` : `${t.durationMin / 60} hr`}` : "All day", t.location, who(t.memberIds), reminder ? `🔔 ${reminder.toLowerCase()}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {canUse && (
                    <span className="flex items-center gap-1">
                      <FormModal title={`Add "${t.title}" to the calendar`} description={t.weekdays.length ? "It repeats every week from the start date. Leave the end date empty to keep going." : undefined} triggerLabel="Use" triggerIcon={<CalendarPlus className="size-4" />} triggerSize="sm" action={useEventTemplate} size="sm">
                        <input type="hidden" name="id" value={t.id} />
                        <FormRow>
                          <DateField name="startDate" label="Starting" required defaultValue={today} />
                          {t.weekdays.length > 0 && <DateField name="until" label="Ending (optional)" />}
                        </FormRow>
                      </FormModal>
                      {(viewer.isParent || t.createdByMemberId === viewer.member.id) && (
                        <>
                          <FormModal title="Edit template" triggerContent={<Pencil className="mx-auto size-4" />} triggerAriaLabel={`Edit ${t.name}`} triggerClassName={iconBtn} action={saveEventTemplate}>
                            <TemplateFields t={t} members={members} cats={cats} me={viewer.member.id} />
                          </FormModal>
                          <DeleteButton action={deleteEventTemplate} fields={{ id: t.id }} what={`the template "${t.name}" (events already added stay)`} />
                        </>
                      )}
                    </span>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
