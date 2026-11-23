import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { carryQuestions, deletePregnancyAppointment, deletePregnancyItem, updatePregnancyItem } from "@/app/actions/pregnancy";
import { ActionButton, CheckCircle, DeleteButton } from "@/components/forms/inline";
import { AppointmentModal, PregnancyItemModal } from "@/components/pregnancy/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { formatShortDate, utcToZoned } from "@/lib/dates";
import { APPOINTMENT_KINDS, QUESTION_CATEGORIES } from "@/lib/pregnancy/catalog";
import { appointmentsOf, entriesOf, itemsOf, type PAppointment } from "@/lib/pregnancy/queries";
import { fileUrl } from "@/lib/files";
import { PregnancyHeader, pregnancyContext, whenOf } from "../../shared";

export const metadata: Metadata = { title: "Appointments" };
const icon = "inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink";

export default async function AppointmentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, tz, now, can } = ctx;
  const [appts, questions, docs] = await Promise.all([appointmentsOf(p.id, { order: "desc", limit: 200 }), itemsOf(p.id, "question"), entriesOf(p.id, ["document"], { category: "appointment", limit: 100 })]);
  const nowMs = ctx.nowDate.getTime();
  const upcoming = appts.filter((a) => a.startsAt.getTime() >= nowMs - 3 * 3600_000).reverse();
  const past = appts.filter((a) => a.startsAt.getTime() < nowMs - 3 * 3600_000);
  const label = (a: PAppointment) => `${a.title.replace(/^🤰\s*/, "")} · ${formatShortDate(utcToZoned(a.startsAt, tz).date)}`;
  const open = questions.filter((q) => !q.done);
  const filter = QUESTION_CATEGORIES.some((c) => c.value === sp.q) ? sp.q! : "all";
  const shownQs = filter === "all" ? questions : questions.filter((q) => q.list === filter);
  const editAppt = can("appointments");
  const editQ = can("questions");
  const apptOpts = upcoming.map((a) => ({ id: a.id, label: label(a) }));

  const card = (a: PAppointment, isPast: boolean) => {
    const z = utcToZoned(a.startsAt, tz);
    const kind = APPOINTMENT_KINDS.find((k) => k.value === a.kind);
    const qs = questions.filter((q) => q.appointmentId === a.id);
    const files = docs.filter((d) => d.appointmentId === a.id);
    const openHere = qs.filter((q) => !q.done).length;
    return (
      <li key={a.id}>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden>
              {kind?.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.title.replace(/^🤰\s*/, "")}</p>
              <p className="text-sm text-muted">{[whenOf(a.startsAt, tz), a.provider, a.location].filter(Boolean).join(" · ")}</p>
              {a.tests && <p className="mt-1 text-sm">🧪 {a.tests}</p>}
              {a.results && <p className="mt-1 text-sm">📝 {a.results}</p>}
              {a.questions && <p className="mt-1 text-sm whitespace-pre-line">💬 {a.questions}</p>}
              {a.notes && <p className="mt-1 text-sm whitespace-pre-line text-muted">{a.notes}</p>}
              {a.followUpOn && <p className="mt-1 text-sm">↪ Follow up by {formatShortDate(a.followUpOn)}</p>}
              {files.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-2 text-sm">
                  {files.map((d) => (
                    <a key={d.id} href={fileUrl(d.fileId) ?? "#"} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                      📎 {d.title || "Attachment"}
                    </a>
                  ))}
                </p>
              )}
              {qs.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {qs.map((q) => (
                    <li key={q.id} className={q.done ? "text-muted line-through" : ""}>
                      ❓ {q.title}
                    </li>
                  ))}
                </ul>
              )}
              {isPast && openHere > 0 && editQ && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton action={carryQuestions} fields={{ pregnancyId: p.id, from: a.id, to: upcoming[0]?.id ?? "" }} className="h-9 rounded-lg bg-sunken px-3 text-sm ring-1 ring-line hover:bg-primary-50">
                    Carry {openHere} unanswered to {upcoming[0] ? "the next visit" : "the general list"}
                  </ActionButton>
                </div>
              )}
            </div>
            {editAppt && (
              <span className="flex shrink-0">
                <AppointmentModal
                  pregnancyId={p.id}
                  now={now}
                  openQuestions={open.filter((q) => q.appointmentId !== a.id).map((q) => ({ id: q.id, title: q.title }))}
                  item={{ id: a.id, kind: a.kind, title: a.title.replace(/^🤰\s*/, ""), date: z.date, time: z.time, duration: a.endsAt ? Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000) : 60, provider: a.provider, location: a.location, questions: a.questions, tests: a.tests, results: a.results, notes: a.notes, followUpOn: a.followUpOn, reminderMinutes: a.reminderMinutes }}
                  triggerContent={<Pencil className="size-4" />}
                  triggerClassName={icon}
                />
                <DeleteButton action={deletePregnancyAppointment} fields={{ id: a.id }} what="this appointment" />
              </span>
            )}
          </div>
        </Card>
      </li>
    );
  };

  return (
    <>
      <PregnancyHeader ctx={ctx} active="appointments" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Appointments appear on the family calendar, shared the same way as this pregnancy.</p>
        {editAppt && <AppointmentModal pregnancyId={p.id} now={now} defaultProvider={p.provider} openQuestions={open.map((q) => ({ id: q.id, title: q.title }))} />}
      </div>
      <h2 className="mb-2 text-sm font-semibold text-muted">Upcoming</h2>
      {upcoming.length ? <ul className="mb-6 flex flex-col gap-3">{upcoming.map((a) => card(a, false))}</ul> : <p className="mb-6 text-sm text-muted">No upcoming appointments.</p>}

      <Card className="mb-6" id="questions">
        <CardHeader title={`Questions for your provider${open.length ? ` (${open.length} open)` : ""}`} action={editQ ? <PregnancyItemModal pregnancyId={p.id} kind="question" appointments={apptOpts} triggerLabel="Add questions" /> : undefined} />
        <div className="mb-3 overflow-x-auto">
          <SegmentLinks active={filter} items={[{ key: "all", label: "All", href: `?` }, ...QUESTION_CATEGORIES.filter((c) => questions.some((q) => q.list === c.value)).map((c) => ({ key: c.value, label: c.label, href: `?q=${c.value}` }))]} />
        </div>
        {shownQs.length ? (
          <ul className="divide-y divide-line">
            {shownQs.map((q) => {
              const at = appts.find((a) => a.id === q.appointmentId);
              return (
                <li key={q.id} className="flex items-start gap-3 py-2.5">
                  <CheckCircle action={updatePregnancyItem} id={q.id} done={q.done} label={q.done ? "Mark unanswered" : "Mark answered"} disabled={!editQ} />
                  <div className="min-w-0 flex-1">
                    <p className={q.done ? "text-muted line-through" : "font-medium"}>{q.title}</p>
                    <p className="text-sm text-muted">
                      <Badge>{QUESTION_CATEGORIES.find((c) => c.value === q.list)?.label ?? "Other"}</Badge> {at ? `Ask at: ${label(at)}` : ""}
                    </p>
                    {q.notes && <p className="mt-1 text-sm whitespace-pre-line">💬 {q.notes}</p>}
                  </div>
                  {editQ && (
                    <span className="flex shrink-0">
                      <PregnancyItemModal pregnancyId={p.id} kind="question" appointments={apptOpts} item={{ id: q.id, title: q.title, list: q.list, status: q.status, notes: q.notes, rating: q.rating, appointmentId: q.appointmentId, data: q.data }} triggerContent={<Pencil className="size-4" />} triggerClassName={icon} />
                      <DeleteButton action={deletePregnancyItem} fields={{ id: q.id }} what="this question" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Jot questions down as you think of them, then pick them when you add an appointment. Tick them off once answered and add the answer as a note.</p>
        )}
      </Card>

      {past.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-muted">Past appointments</h2>
          <ul className="flex flex-col gap-3">{past.map((a) => card(a, true))}</ul>
        </>
      )}
    </>
  );
}
