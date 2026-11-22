import type { Metadata } from "next";
import { BabyLogModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { logsOfKinds } from "@/lib/baby";
import { MILESTONE_IDEAS, monthsOld } from "@/lib/baby-kinds";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Baby milestones" };

/** Firsts and milestones with photos, teeth, and ideas for what's coming up. */
export default async function BabyMilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await babyContext(id);
  const { viewer, baby, today, units, now, canUse } = ctx;
  const [logs, names] = await Promise.all([logsOfKinds(baby.id, ["milestone", "teeth"], 300), memberNames(viewer)]);
  const milestones = logs.filter((l) => l.kind === "milestone");
  const teeth = logs.filter((l) => l.kind === "teeth");
  const have = new Set(milestones.map((m) => String(m.data.title ?? "").toLowerCase()));
  const age = monthsOld(baby.birthDate, today);
  const ideas = MILESTONE_IDEAS.filter((m) => !have.has(m.title.toLowerCase()) && (age === null || (m.months <= age + 3 && m.months >= age - 6)));

  return (
    <>
      <BabyHeader ctx={ctx} active="milestones" />
      {canUse && (
        <div className="mb-4 flex flex-wrap gap-2">
          <BabyLogModal babyId={baby.id} kind="milestone" units={units} now={now} triggerLabel="⭐ Log a milestone" />
          <BabyLogModal babyId={baby.id} kind="teeth" units={units} now={now} triggerLabel="🦷 Log a tooth" />
        </div>
      )}
      {canUse && ideas.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={age !== null ? "Coming up around this age" : "Milestones to watch for"} />
          <div className="flex flex-wrap gap-2">
            {ideas.map((m) => (
              <BabyLogModal
                key={m.title}
                babyId={baby.id}
                kind="milestone"
                units={units}
                now={now}
                defaultTitle={m.title}
                triggerContent={<>＋ {m.title}</>}
                triggerClassName="inline-flex h-9 items-center rounded-full px-3 text-sm ring-1 ring-line hover:bg-sunken"
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">Every baby grows at their own pace. Ask your pediatrician if you have any concerns.</p>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Milestones (${milestones.length})`} />
          <LogList ctx={ctx} logs={milestones} names={names} showDate empty="First smile, rolling over, first steps: record them with a photo." />
        </Card>
        <Card>
          <CardHeader title={`Teeth (${teeth.length})`} />
          <LogList ctx={ctx} logs={teeth} names={names} showDate empty="Log each tooth as it comes in." />
        </Card>
      </div>
    </>
  );
}
