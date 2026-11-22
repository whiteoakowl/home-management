import type { Metadata } from "next";
import { BabyLogModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProgressBar } from "@/components/ui/display";
import { logsOfKinds } from "@/lib/baby";
import { ACTIVITIES, ACTIVITY_CATEGORIES, DEV_AREAS, MILESTONE_CHECKLIST, monthsOld, suggestActivities, type ActivityCategory, type DevArea } from "@/lib/baby-kinds";
import { addDays, formatShortDate, utcToZoned } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Development" };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Milestones (checklist and firsts), development notes and age-based activities. */
export default async function BabyDevelopmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await babyContext(id);
  const { viewer, baby, today, units, now, canUse, tz } = ctx;
  const [moments, activities, names] = await Promise.all([logsOfKinds(baby.id, ["milestone", "teeth", "development"], 400), logsOfKinds(baby.id, ["activity"], 200), memberNames(viewer)]);
  const milestones = moments.filter((l) => l.kind === "milestone");
  const notes = moments.filter((l) => l.kind === "development");
  const done = new Map(milestones.map((m) => [norm(String(m.data.title ?? "")), m]));
  const age = monthsOld(baby.birthDate, today);
  const shown = MILESTONE_CHECKLIST.filter((m) => sp.all === "1" || age === null || m.months <= age + 4);
  const expected = MILESTONE_CHECKLIST.filter((m) => age !== null && m.months <= age);
  const reached = expected.filter((m) => done.has(norm(m.title))).length;
  const custom = milestones.filter((m) => !MILESTONE_CHECKLIST.some((c) => norm(c.title) === norm(String(m.data.title ?? ""))));
  const monthAgo = addDays(today, -30);
  const recentActs = activities.filter((a) => utcToZoned(a.startedAt, tz).date >= monthAgo);
  const ideas = suggestActivities(age, recentActs.map((a) => String(a.data.title ?? "")), today, 4);
  const byCat = (Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((c) => ({ c, n: recentActs.filter((a) => ACTIVITIES.find((x) => x.title === a.data.title)?.category === c).length }));
  const library = ACTIVITIES.filter((a) => age === null || (age >= a.from && age < a.to));

  return (
    <>
      <BabyHeader ctx={ctx} active="development" />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardHeader title="Progress" />
          {age !== null && expected.length > 0 ? (
            <>
              <p className="text-sm">
                {reached} of {expected.length} milestones typical by {age} months are recorded.
              </p>
              <ProgressBar value={reached} max={expected.length} label="Milestones recorded" />
            </>
          ) : (
            <p className="text-sm text-muted">Add a birthday to see milestones for their age.</p>
          )}
          <p className="text-sm text-muted">
            Activities in the last 30 days: {byCat.map((x) => `${ACTIVITY_CATEGORIES[x.c]} ${x.n}`).join(" · ")}
          </p>
          <p className="text-xs text-muted">Every child develops at their own pace. If something worries you, ask your pediatrician; it&apos;s always okay to ask.</p>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardHeader title="Ideas for today" />
          <ul className="flex flex-col gap-3">
            {ideas.map((a) => (
              <li key={a.title} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.title} <Badge>{ACTIVITY_CATEGORIES[a.category]}</Badge>
                  </p>
                  <p className="text-sm text-muted">{a.how}</p>
                </div>
                {canUse && <BabyLogModal babyId={baby.id} kind="activity" units={units} now={now} defaultTitle={a.title} item={undefined} triggerLabel="Did it" triggerContent={<>✓ Did it</>} triggerClassName="h-9 shrink-0 rounded-full px-3 text-sm font-medium ring-1 ring-line hover:bg-sunken" />}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mb-4 flex flex-col gap-4">
        <CardHeader title="Milestone checklist" action={canUse ? <BabyLogModal babyId={baby.id} kind="milestone" units={units} now={now} triggerLabel="+ Custom milestone" /> : undefined} />
        {(Object.keys(DEV_AREAS) as DevArea[]).map((area) => {
          const list = shown.filter((m) => m.area === area);
          if (!list.length) return null;
          return (
            <section key={area}>
              <h3 className="mb-2 font-semibold">{DEV_AREAS[area]}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((m) => {
                  const got = done.get(norm(m.title));
                  return (
                    <li key={m.title} className={cn("flex items-center gap-3 rounded-xl border p-3", got ? "border-olive-200 bg-olive-50" : "border-line")}>
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-sm", got ? "bg-olive-500 text-white" : "bg-sunken text-muted")} aria-hidden>
                        {got ? "✓" : ""}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted">{got ? `Reached ${formatShortDate(utcToZoned(got.startedAt, tz).date)}` : `Around ${m.months} months`}</p>
                      </div>
                      {!got && canUse && <BabyLogModal babyId={baby.id} kind="milestone" units={units} now={now} defaultTitle={m.title} triggerContent={<>Reached</>} triggerClassName="h-9 shrink-0 rounded-full px-3 text-sm font-medium ring-1 ring-line hover:bg-sunken" />}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {sp.all !== "1" && (
          <a href={`/baby/${baby.id}/development?all=1`} className="text-sm font-medium text-primary-700 hover:underline">
            Show every milestone to age 3 →
          </a>
        )}
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Firsts & custom milestones (${custom.length})`} />
          <LogList ctx={ctx} logs={custom} names={names} showDate empty="First trip to the beach, first time clapping… anything that matters to you." />
        </Card>
        <Card>
          <CardHeader title="Development journal" action={canUse ? <BabyLogModal babyId={baby.id} kind="development" units={units} now={now} triggerLabel="+ Note" /> : undefined} />
          <LogList ctx={ctx} logs={notes} names={names} showDate empty="Notes on new skills, words, questions for the next checkup." />
        </Card>
      </div>

      <Card>
        <CardHeader title="Activity ideas for this age" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {library.map((a) => (
            <li key={a.title} className="rounded-xl bg-sunken/60 p-3">
              <p className="font-medium">
                {a.title} <Badge>{ACTIVITY_CATEGORIES[a.category]}</Badge>
              </p>
              <p className="text-sm text-muted">{a.how}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
