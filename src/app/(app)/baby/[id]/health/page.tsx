import type { Metadata } from "next";
import { Pencil, Phone } from "lucide-react";
import { BabyLogModal, BabyModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { canManageBaby, logsOfKinds, upcomingAppointments } from "@/lib/baby";
import { BABY_KINDS, HEALTH_KINDS, isFever, monthsOld, VACCINE_SCHEDULE } from "@/lib/baby-kinds";
import { fileUrl } from "@/lib/files";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Baby health" };

const norm = (s: string) => s.toLowerCase();

/** Medical record, vaccines, medicines, appointments, symptoms and the full history. */
export default async function BabyHealthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await babyContext(id);
  const { viewer, baby, units, now, canUse, nowDate, today } = ctx;
  const manage = canManageBaby(viewer, baby);
  const [logs, appts, names, members] = await Promise.all([logsOfKinds(baby.id, HEALTH_KINDS, 500), upcomingAppointments(baby.id, nowDate), memberNames(viewer), manage ? memberOptions(viewer) : Promise.resolve([])]);
  const past = logs.filter((l) => l.startedAt <= nowDate);
  const of = (...k: string[]) => past.filter((l) => k.includes(l.kind));
  const recentFever = past.find((l) => isFever(l) && nowDate.getTime() - l.startedAt.getTime() < 48 * 3600_000);
  const lastMed = of("medicine")[0];
  const vaccines = of("vaccine").map((v) => norm(String(v.data.title ?? "")));
  const age = monthsOld(baby.birthDate, today);
  const add = (k: (typeof HEALTH_KINDS)[number]) => <BabyLogModal key={k} babyId={baby.id} kind={k} units={units} now={now} triggerLabel={`${BABY_KINDS[k].emoji} ${BABY_KINDS[k].label}`} />;

  return (
    <>
      <BabyHeader ctx={ctx} active="health" />
      {recentFever && (
        <div role="alert" className="mb-4 rounded-2xl border border-wine-100 bg-wine-50 px-4 py-3 text-[15px] text-wine-600">
          🌡️ Fever logged in the last two days. For babies under 3 months, call the doctor for any temperature of 100.4°F (38°C) or higher. Call sooner for any baby who seems very unwell.
        </div>
      )}
      {canUse && <div className="mb-4 flex flex-wrap gap-2">{HEALTH_KINDS.map(add)}</div>}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <CardHeader
            title="Medical record"
            action={
              manage ? (
                <BabyModal
                  members={members}
                  item={{ ...baby, imageUrl: fileUrl(baby.imageFileId, true) }}
                  triggerContent={
                    <>
                      <Pencil className="size-4" /> Edit
                    </>
                  }
                  triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
                />
              ) : undefined
            }
          />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Allergies</dt>
              <dd className={cn("font-medium", baby.allergies && "text-wine-600")}>{baby.allergies || "None recorded"}</dd>
            </div>
            <div>
              <dt className="text-muted">Medical conditions</dt>
              <dd className="font-medium">{baby.conditions || "None recorded"}</dd>
            </div>
            <div>
              <dt className="text-muted">Pediatrician</dt>
              <dd className="font-medium">{baby.doctorName || "—"}</dd>
              {baby.clinic && <dd className="text-muted">{baby.clinic}</dd>}
            </div>
            <div>
              <dt className="text-muted">Doctor&apos;s phone</dt>
              <dd>
                {baby.doctorPhone ? (
                  <a href={`tel:${baby.doctorPhone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
                    <Phone className="size-3.5" aria-hidden /> {baby.doctorPhone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          {lastMed && (
            <p className="text-sm text-muted">
              Last medicine: <strong className="text-ink">{String(lastMed.data.title ?? "")}</strong>
              {lastMed.data.dose ? ` (${String(lastMed.data.dose)})` : ""}, {Math.round((nowDate.getTime() - lastMed.startedAt.getTime()) / 3600_000)} h ago. Check the label before the next dose.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="Upcoming appointments" action={canUse ? add("appointment") : undefined} />
          <LogList ctx={ctx} logs={appts} names={names} showDate empty="No appointments coming up. Add one and everyone helping gets a reminder the day before and an hour before." />
        </Card>
      </div>

      <Card className="mb-4 flex flex-col gap-3">
        <CardHeader title="Vaccinations" action={canUse ? add("vaccine") : undefined} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {VACCINE_SCHEDULE.map((v) => {
            const gotAll = v.vaccines.every((x) => vaccines.some((g) => g.includes(norm(x.split(" (")[0]!))));
            const due = age !== null && v.months <= age;
            return (
              <li key={v.label} className={cn("rounded-xl border p-3", gotAll ? "border-olive-200 bg-olive-50" : "border-line")}>
                <p className="flex items-center gap-2 font-medium">
                  {v.label} {gotAll ? <Badge tone="olive">Logged</Badge> : due ? <Badge tone="primary">Due by now</Badge> : null}
                </p>
                <p className="text-sm text-muted">{v.vaccines.join(", ")}</p>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">The routine US schedule as a guide. Your pediatrician&apos;s plan comes first.</p>
        <LogList ctx={ctx} logs={of("vaccine")} names={names} showDate empty="Log each vaccine visit to keep the record here." />
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="💊 Medicines & vitamins" />
          <LogList ctx={ctx} logs={of("medicine", "vitamin").slice(0, 20)} names={names} showDate empty="Nothing logged. Set a medicine reminder under Schedule & reminders." />
        </Card>
        <Card>
          <CardHeader title="🤧 Symptoms & illness" />
          <LogList ctx={ctx} logs={of("symptom").slice(0, 20)} names={names} showDate empty="Log symptoms to spot how an illness is going and to share with the doctor." />
        </Card>
        <Card>
          <CardHeader title="🌡️ Temperatures" />
          <LogList ctx={ctx} logs={of("temperature").slice(0, 20)} names={names} showDate empty="No temperatures logged." />
        </Card>
        <Card>
          <CardHeader title="🩺 Doctor visits" />
          <LogList ctx={ctx} logs={of("doctor", "appointment").slice(0, 20)} names={names} showDate empty="Past visits and check-ups show here." />
        </Card>
      </div>

      <Card>
        <CardHeader title="Medical history" />
        <LogList ctx={ctx} logs={past.slice(0, 100)} names={names} showDate empty="Everything health-related, newest first." />
      </Card>
    </>
  );
}
