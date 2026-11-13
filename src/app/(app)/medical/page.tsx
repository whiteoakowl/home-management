import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, FileText, HeartPulse, Pill, Salad, Stethoscope, TriangleAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { fmtDate } from "@/components/records/detail-list";
import { addDays, todayIn, zonedToUtc } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { listMedical, medicalAppointments } from "@/lib/medical";
import { SEVERITIES, SEVERITY_TONE } from "@/lib/medical-config";
import { listFamilyMembers } from "@/lib/dal";
import { memberOptions } from "@/lib/queries";
import { AppointmentList } from "./appointment-list";
import { AppointmentModal } from "./appointment-modal";
import { medicalViewer } from "./kind-page";
import { MedicalDisclaimer, MedicalTabs } from "./medical-tabs";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const metadata: Metadata = { title: "Medical" };

export default async function MedicalDashboard() {
  const viewer = await medicalViewer();
  const today = todayIn(viewer.family.timezone);
  const soon = addDays(today, 30);
  const [members, fam, alls, rests, conds, meds, docs, appts] = await Promise.all([
    memberOptions(viewer),
    listFamilyMembers(viewer.family.id),
    listMedical(viewer, "allergy"),
    listMedical(viewer, "restriction"),
    listMedical(viewer, "condition"),
    listMedical(viewer, "medication"),
    listMedical(viewer, "document"),
    medicalAppointments(viewer, { from: zonedToUtc(today, "00:00", viewer.family.timezone) }),
  ]);
  const count = (rows: { r: { memberId: string } }[], id: string) => rows.filter(({ r }) => r.memberId === id).length;
  const serious = alls.filter(({ r }) => r.severity === "severe" || r.severity === "life_threatening");
  const refills = meds.filter(({ r }) => r.active && r.nextRefillOn && r.nextRefillOn <= soon).sort((a, b) => a.r.nextRefillOn!.localeCompare(b.r.nextRefillOn!));
  const followUps = conds.filter(({ r }) => r.active && r.followUpOn && r.followUpOn <= addDays(today, 60));
  const expiring = docs.filter(({ r }) => r.expiresOn && r.expiresOn <= addDays(today, 60));
  const sev = (v: string) => SEVERITIES.find((s) => s.value === v)?.label ?? v;
  const tiles = [
    { href: "/medical/allergies", label: "Allergies", icon: TriangleAlert, n: alls.length },
    { href: "/medical/diet", label: "Food restrictions", icon: Salad, n: rests.length },
    { href: "/medical/conditions", label: "Conditions", icon: Stethoscope, n: conds.filter(({ r }) => r.active).length },
    { href: "/medical/medications", label: "Medications", icon: Pill, n: meds.filter(({ r }) => r.active).length },
    { href: "/medical/documents", label: "Documents", icon: FileText, n: docs.length },
    { href: "/medical/calendar", label: "Appointments", icon: CalendarClock, n: appts.length },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Care"
        title="Family Medical & Health"
        description="Profiles, allergies, conditions, medications and documents, private to each person and the parents unless shared."
        actions={viewer.can("medical", "edit") && <AppointmentModal members={members} />}
      />
      <MedicalTabs active="overview" />

      {serious.length > 0 && (
        <section aria-labelledby="emergency" className="mb-6 rounded-2xl border border-wine-200 bg-wine-50 p-4 sm:p-5">
          <h2 id="emergency" className="flex items-center gap-2 font-semibold text-wine-700">
            <TriangleAlert className="size-5" aria-hidden /> Serious allergies
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {serious.map(({ r, memberName, memberColor }) => (
              <li key={r.id} className="flex items-start gap-3 rounded-xl bg-surface p-3">
                <Avatar name={memberName} color={memberColor} size="sm" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {memberName}: {r.name} <Badge tone={SEVERITY_TONE[r.severity]}>{sev(r.severity)}</Badge>
                  </p>
                  {r.emergencyInstructions && <p className="mt-1 text-sm whitespace-pre-line text-ink-soft">{r.emergencyInstructions}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <t.icon className="size-5" aria-hidden />
            </span>
            <span className="font-medium text-ink">{t.label}</span>
            <span className="text-sm text-muted">{t.n} recorded</span>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Family members</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {fam.map((m) => (
          <Link key={m.id} href={`/medical/members/${m.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
            <Avatar name={m.displayName} color={m.color} photoUrl={fileUrl(m.avatarFileId, true)} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold">{m.displayName}</p>
              <p className="text-sm text-muted">
                {plural(count(alls, m.id), "allergy", "allergies")} · {plural(count(meds.filter(({ r }) => r.active), m.id), "med", "meds")}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Upcoming appointments" icon={<CalendarClock className="size-4" />} href="/medical/calendar" />
          <AppointmentList viewer={viewer} rows={appts.slice(0, 5)} members={members} empty="No upcoming appointments." />
        </Card>
        <Card>
          <CardHeader title="Coming up" icon={<HeartPulse className="size-4" />} />
          <ul className="divide-y divide-line">
            {refills.map(({ r, memberName }) => (
              <li key={r.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <Link href="/medical/medications" className="font-medium hover:text-primary-700">
                  Refill {r.name} <span className="font-normal text-muted">· {memberName}</span>
                </Link>
                <span className={r.nextRefillOn! < today ? "text-wine-600" : "text-muted"}>{fmtDate(r.nextRefillOn)}</span>
              </li>
            ))}
            {followUps.map(({ r, memberName }) => (
              <li key={r.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <Link href="/medical/conditions" className="font-medium hover:text-primary-700">
                  Follow-up: {r.name} <span className="font-normal text-muted">· {memberName}</span>
                </Link>
                <span className="text-muted">{fmtDate(r.followUpOn)}</span>
              </li>
            ))}
            {expiring.map(({ r, memberName }) => (
              <li key={r.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <Link href="/medical/documents" className="font-medium hover:text-primary-700">
                  {r.title} expires <span className="font-normal text-muted">· {memberName}</span>
                </Link>
                <span className={r.expiresOn! < today ? "text-wine-600" : "text-muted"}>{fmtDate(r.expiresOn)}</span>
              </li>
            ))}
            {!refills.length && !followUps.length && !expiring.length && <li className="py-3 text-sm text-muted">No refills, follow-ups or expiring documents in the next 30–60 days.</li>}
          </ul>
        </Card>
      </div>
      <MedicalDisclaimer />
    </>
  );
}
