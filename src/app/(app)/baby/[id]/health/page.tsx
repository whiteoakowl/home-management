import type { Metadata } from "next";
import { BabyLogModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { logsOfKinds } from "@/lib/baby";
import { BABY_KINDS, HEALTH_KINDS, isFever } from "@/lib/baby-kinds";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Baby health" };

/** Temperatures, medicine, symptoms, vaccines and doctor visits. */
export default async function BabyHealthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await babyContext(id);
  const { viewer, baby, units, now, canUse, nowDate } = ctx;
  const [logs, names] = await Promise.all([logsOfKinds(baby.id, HEALTH_KINDS, 300), memberNames(viewer)]);
  const of = (k: string) => logs.filter((l) => l.kind === k);
  const recentFever = logs.find((l) => isFever(l) && nowDate.getTime() - l.startedAt.getTime() < 48 * 3600_000);
  const lastMed = of("medicine")[0];

  return (
    <>
      <BabyHeader ctx={ctx} active="health" />
      {recentFever && (
        <div className="mb-4 rounded-2xl border border-wine-100 bg-wine-50 px-4 py-3 text-[15px] text-wine-600">
          🌡️ Fever logged in the last two days. For babies under 3 months, call the doctor for any temperature of 100.4°F (38°C) or higher.
        </div>
      )}
      {canUse && (
        <div className="mb-4 flex flex-wrap gap-2">
          {HEALTH_KINDS.map((k) => (
            <BabyLogModal key={k} babyId={baby.id} kind={k} units={units} now={now} triggerLabel={`${BABY_KINDS[k].emoji} ${BABY_KINDS[k].label}`} />
          ))}
        </div>
      )}
      {lastMed && (
        <p className="mb-4 text-sm text-muted">
          Last medicine: <strong className="text-ink">{String(lastMed.data.title ?? "")}</strong>
          {lastMed.data.dose ? ` (${String(lastMed.data.dose)})` : ""}, {Math.round((nowDate.getTime() - lastMed.startedAt.getTime()) / 3600_000)} h ago. Check the label before the next dose.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {HEALTH_KINDS.map((k) => (
          <Card key={k}>
            <CardHeader title={`${BABY_KINDS[k].emoji} ${k === "doctor" ? "Doctor visits" : k === "medicine" ? "Medicine" : `${BABY_KINDS[k].label}s`}`} />
            <LogList ctx={ctx} logs={of(k).slice(0, 15)} names={names} showDate empty="Nothing logged." />
          </Card>
        ))}
      </div>
    </>
  );
}
