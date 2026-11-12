import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Clock, Lock, MapPin, Paperclip, Pencil, Repeat, Trash2, Users } from "lucide-react";
import { db } from "@/db";
import { calendarEvents, categories, eventAttachments, eventAttendees, files, recurrenceRules } from "@/db/schema";
import { deleteEvent } from "@/app/actions/calendar";
import { EventFormModal } from "@/components/calendar/event-form";
import { ActionButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { memberColor } from "@/lib/colors";
import { getViewer, visibleTo } from "@/lib/dal";
import { formatLongDate, utcToZoned } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { categoryOptions, memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { describeRule, type Rule } from "@/lib/recurrence";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params, searchParams }: PageProps<"/calendar/event/[id]">) {
  const { id } = await params;
  const { on } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("calendar")) notFound();
  const [row] = await db
    .select({ e: calendarEvents, rule: recurrenceRules, category: categories.name, catColor: categories.color })
    .from(calendarEvents)
    .leftJoin(recurrenceRules, eq(recurrenceRules.id, calendarEvents.recurrenceRuleId))
    .leftJoin(categories, eq(categories.id, calendarEvents.categoryId))
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.familyId, viewer.family.id), visibleTo(viewer, { id: calendarEvents.id, visibility: calendarEvents.visibility, author: calendarEvents.createdByMemberId }, "event")));
  if (!row) notFound();
  const { e, rule } = row;
  const tz = viewer.family.timezone;
  const [members, cats, attendees, attachments, access] = await Promise.all([
    memberOptions(viewer),
    categoryOptions(viewer, "calendar"),
    db.select({ id: eventAttendees.memberId }).from(eventAttendees).where(eq(eventAttendees.eventId, id)),
    db.select({ id: files.id, name: files.originalName, mime: files.mimeType }).from(eventAttachments).innerJoin(files, eq(files.id, eventAttachments.fileId)).where(eq(eventAttachments.eventId, id)),
    getRecordAccess("event", [id]),
  ]);
  const start = utcToZoned(e.startsAt, tz);
  const end = e.endsAt ? utcToZoned(e.endsAt, tz) : null;
  const shown = typeof on === "string" ? on : start.date;
  const people = attendees.map((a) => members.find((m) => m.id === a.id)).filter(Boolean) as typeof members;
  const shared = (access.get(id) ?? []).map((a) => members.find((m) => m.id === a)?.displayName).filter(Boolean);
  const color = memberColor(e.color ?? row.catColor ?? people[0]?.color);
  const canEdit = viewer.can("calendar", "edit") && (viewer.isParent || e.createdByMemberId === viewer.member.id);
  const fmt = (t: string) => new Date(`2000-01-01T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href={`/calendar?date=${shown}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Calendar
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: color.solid }} aria-hidden />
            {row.category ?? "Event"}
          </span>
        }
        title={e.title}
        actions={
          canEdit ? (
            <>
              <EventFormModal
                me={viewer.member.id}
                members={members}
                categories={cats}
                defaultDate={start.date}
                defaults={{
                  id: e.id,
                  title: e.title,
                  description: e.description,
                  location: e.location,
                  date: start.date,
                  endDate: end?.date ?? start.date,
                  startTime: start.time,
                  endTime: end?.time ?? "",
                  allDay: e.allDay,
                  categoryId: e.categoryId,
                  color: e.color,
                  reminderMinutes: e.reminderMinutes,
                  notes: e.notes,
                  attendees: attendees.map((a) => a.id),
                  visibility: e.visibility,
                  sharedWith: access.get(id) ?? [],
                  rule: rule ? { freq: rule.freq, interval: rule.interval, byWeekday: rule.byWeekday, byMonthDay: rule.byMonthDay, byMonth: rule.byMonth, until: rule.until } : null,
                }}
                triggerContent={
                  <>
                    <Pencil className="size-4" /> Edit
                  </>
                }
              />
              <ActionButton action={deleteEvent} fields={{ id }} confirm={rule ? "Delete this event and all its repeats?" : "Delete this event?"} className="h-9 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
                <Trash2 className="size-4" /> Delete
              </ActionButton>
            </>
          ) : undefined
        }
      />
      <Card className="flex flex-col gap-4">
        <p className="flex items-start gap-3 text-[15px]">
          <Clock className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <span>
            {formatLongDate(shown)}
            <br />
            <span className="text-muted">
              {e.allDay ? (end && end.date !== start.date ? `All day, through ${formatLongDate(end.date)}` : "All day") : `${fmt(start.time)}${end ? ` – ${fmt(end.time)}` : ""}`}
            </span>
          </span>
        </p>
        {rule && (
          <p className="flex items-center gap-3 text-[15px]">
            <Repeat className="size-5 text-muted" aria-hidden /> {describeRule(rule as unknown as Rule)}
          </p>
        )}
        {e.location && (
          <p className="flex items-center gap-3 text-[15px]">
            <MapPin className="size-5 text-muted" aria-hidden /> {e.location}
          </p>
        )}
        {people.length > 0 && (
          <div className="flex items-start gap-3">
            <Users className="mt-1 size-5 text-muted" aria-hidden />
            <ul className="flex flex-wrap gap-2">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-full bg-sunken py-1 pr-3 pl-1 text-sm">
                  <Avatar name={p.displayName} color={p.color} size="xs" /> {p.displayName}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="flex items-center gap-3 text-sm text-muted">
          <Lock className="size-5" aria-hidden />
          {e.visibility === "family" ? "Visible to the whole family" : e.visibility === "private" ? "Private: only the creator and parents" : `Visible to: ${shared.join(", ")} (and parents)`}
        </p>
        {e.reminderMinutes && <Badge tone="mist" className="w-fit">Reminder {e.reminderMinutes >= 1440 ? "1 day" : `${e.reminderMinutes} min`} before</Badge>}
        {e.description && <p className="text-[15px] whitespace-pre-line">{e.description}</p>}
        {e.notes && <p className="rounded-xl bg-sunken/60 p-3 text-sm whitespace-pre-line text-ink-soft">{e.notes}</p>}
        {attachments.length > 0 && (
          <ul className="flex flex-col gap-1">
            {attachments.map((a) => (
              <li key={a.id}>
                <a href={fileUrl(a.id)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline">
                  <Paperclip className="size-4" /> {a.name ?? "Attachment"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
