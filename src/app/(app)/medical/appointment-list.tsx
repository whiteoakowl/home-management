import { MapPin } from "lucide-react";
import { deleteMedicalAppointment } from "@/app/actions/medical";
import type { MemberOption } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { Avatar } from "@/components/ui/display";
import type { Viewer } from "@/lib/dal";
import { utcToZoned } from "@/lib/dates";
import { getRecordAccess } from "@/lib/records";
import { fmtDate } from "@/components/records/detail-list";
import { AppointmentModal } from "./appointment-modal";

type Appt = { id: string; title: string; startsAt: Date; endsAt: Date | null; location: string | null; description: string | null; notes: string | null; reminderMinutes: number | null; visibility: string; sourceId: string | null; createdByMemberId: string | null };

export async function AppointmentList({ viewer, rows, members, empty }: { viewer: Viewer; rows: Appt[]; members: (MemberOption & { role?: string })[]; empty: string }) {
  if (!rows.length) return <p className="py-3 text-sm text-muted">{empty}</p>;
  const access = await getRecordAccess("event", rows.map((r) => r.id));
  const tz = viewer.family.timezone;
  const canEdit = viewer.can("medical", "edit");
  return (
    <ul className="divide-y divide-line">
      {rows.map((a) => {
        const z = utcToZoned(a.startsAt, tz);
        const m = members.find((x) => x.id === a.sourceId);
        const mine = viewer.isParent || a.createdByMemberId === viewer.member.id || a.sourceId === viewer.member.id;
        const selected = (access.get(a.id) ?? []).filter((id) => id !== a.sourceId && id !== a.createdByMemberId);
        const [hh, mm] = z.time.split(":").map(Number);
        const time = new Date(Date.UTC(2000, 0, 1, hh, mm)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
        return (
          <li key={a.id} className="flex items-start gap-3 py-3">
            <div className="w-16 shrink-0 rounded-xl bg-primary-50 py-1.5 text-center text-primary-700">
              <p className="text-[11px] font-semibold uppercase">{new Date(`${z.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</p>
              <p className="font-display text-xl leading-none font-semibold">{Number(z.date.slice(8))}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{a.title}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                {m && (
                  <span className="inline-flex items-center gap-1">
                    <Avatar name={m.displayName} color={m.color} size="xs" /> {m.displayName}
                  </span>
                )}
                <span>
                  {fmtDate(z.date)} · {time}
                </span>
                {a.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden /> {a.location}
                  </span>
                )}
              </p>
              {a.description && <p className="mt-1 text-sm whitespace-pre-line text-ink-soft">{a.description}</p>}
              {a.notes && <p className="mt-1 text-sm whitespace-pre-line text-muted">Notes: {a.notes}</p>}
            </div>
            {canEdit && mine && (
              <div className="flex shrink-0">
                <AppointmentModal
                  edit
                  members={members}
                  d={{
                    id: a.id,
                    title: a.title,
                    memberId: a.sourceId ?? undefined,
                    date: z.date,
                    time: z.time,
                    duration: a.endsAt ? Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000) : 60,
                    location: a.location,
                    description: a.description,
                    notes: a.notes,
                    reminderMinutes: a.reminderMinutes,
                    visibility: a.visibility === "family" ? "family" : "selected",
                    selected,
                  }}
                />
                <DeleteButton action={deleteMedicalAppointment} fields={{ id: a.id }} what="this appointment" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
