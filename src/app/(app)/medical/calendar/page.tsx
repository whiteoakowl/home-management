import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { zonedToUtc, todayIn } from "@/lib/dates";
import { medicalAppointments } from "@/lib/medical";
import { memberOptions } from "@/lib/queries";
import { listMedical } from "@/lib/medical";
import { fmtDate } from "@/components/records/detail-list";
import { AppointmentList } from "../appointment-list";
import { AppointmentModal } from "../appointment-modal";
import { medicalViewer } from "../kind-page";
import { MedicalDisclaimer, MedicalTabs } from "../medical-tabs";

export const metadata: Metadata = { title: "Medical calendar" };

export default async function MedicalCalendarPage({ searchParams }: PageProps<"/medical/calendar">) {
  const viewer = await medicalViewer();
  const sp = (await searchParams) as { past?: string };
  const today = todayIn(viewer.family.timezone);
  const startToday = zonedToUtc(today, "00:00", viewer.family.timezone);
  const [members, all, meds, conds, docs] = await Promise.all([
    memberOptions(viewer),
    medicalAppointments(viewer),
    listMedical(viewer, "medication"),
    listMedical(viewer, "condition"),
    listMedical(viewer, "document"),
  ]);
  const upcoming = all.filter((a) => a.startsAt >= startToday);
  const past = all.filter((a) => a.startsAt < startToday).reverse();
  const dates = [
    ...meds.filter(({ r }) => r.active && r.nextRefillOn).map(({ r, memberName }) => ({ date: r.nextRefillOn!, label: `Refill: ${r.name}`, who: memberName, href: "/medical/medications" })),
    ...conds.filter(({ r }) => r.active && r.followUpOn).map(({ r, memberName }) => ({ date: r.followUpOn!, label: `Follow-up: ${r.name}`, who: memberName, href: "/medical/conditions" })),
    ...docs.filter(({ r }) => r.expiresOn).map(({ r, memberName }) => ({ date: r.expiresOn!, label: `Expires: ${r.title}`, who: memberName, href: "/medical/documents" })),
  ]
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <PageHeader
        eyebrow="Medical"
        title="Medical calendar"
        description="Appointments, follow-ups, refills and expirations. Appointments also appear on the family calendar for the people allowed to see them."
        actions={viewer.can("medical", "edit") && <AppointmentModal members={members} />}
      />
      <MedicalTabs active="calendar" />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Upcoming appointments" action={<Link href="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700"><CalendarDays className="size-4" aria-hidden /> Family calendar</Link>} />
          <AppointmentList viewer={viewer} rows={upcoming} members={members} empty="No upcoming appointments." />
          <details className="mt-4" open={sp.past === "1"}>
            <summary className="cursor-pointer text-sm font-medium text-primary-700">Past appointments ({past.length})</summary>
            <AppointmentList viewer={viewer} rows={past} members={members} empty="No past appointments." />
          </details>
        </Card>
        <Card>
          <CardHeader title="Key dates" />
          {dates.length ? (
            <ul className="divide-y divide-line">
              {dates.map((d, i) => (
                <li key={i}>
                  <Link href={d.href} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary-700">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.label}</span>
                      <span className="text-xs text-muted">{d.who}</span>
                    </span>
                    <span className="shrink-0 text-sm text-muted">{fmtDate(d.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted">Refill dates, follow-ups and document expirations show up here.</p>
          )}
        </Card>
      </div>
      <MedicalDisclaimer />
    </>
  );
}
