import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MapPin, PiggyBank, Plane, Users } from "lucide-react";
import { PlanModal } from "@/components/plans/forms";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { listGoals } from "@/lib/goals";
import { memberOptions } from "@/lib/queries";
import { countdownText, daysUntil, listPlans } from "@/lib/trips";

export const metadata: Metadata = { title: "Plans" };

const VIS: Record<string, string> = { private: "Only me", parents: "Parents & me", selected: "Selected people" };

/** Vacations, trips and events: upcoming with a countdown, then past ones. */
export default async function PlansPage({ searchParams }: PageProps<"/plans">) {
  const viewer = await getViewer();
  if (!viewer.can("plans")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const [rows, members, goals] = await Promise.all([listPlans(viewer), memberOptions(viewer), listGoals(viewer, { kind: "savings" })]);
  const canAdd = viewer.can("plans", "use");
  const goalOpts = goals.filter((g) => g.g.status === "active").map((g) => ({ id: g.g.id, name: g.g.name }));
  const upcoming = rows.filter((r) => !r.p.endDate || r.p.endDate >= today || (r.p.startDate ?? "9999") >= today);
  const past = rows.filter((r) => !upcoming.includes(r)).reverse();

  const card = (r: (typeof rows)[number]) => {
    const p = r.p;
    const photo = fileUrl(p.imageFileId, true);
    const left = p.startDate ? daysUntil(today, p.startDate) : null;
    return (
      <li key={p.id}>
        <Link href={`/plans/${p.id}`} className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] hover:border-primary-300">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-32 w-full object-cover" />
          ) : (
            <div className="flex h-20 items-center justify-center bg-gradient-to-br from-primary-50 to-olive-50 text-primary-600">
              <Plane className="size-8" aria-hidden />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{p.title}</p>
              <Badge tone={left !== null && left >= 0 && left <= 14 ? "olive" : "mist"}>{countdownText(today, p.startDate, p.endDate)}</Badge>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {p.startDate && (
                <span>
                  {formatShortDate(p.startDate)}
                  {p.endDate && p.endDate !== p.startDate ? ` – ${formatShortDate(p.endDate)}` : ""}
                </span>
              )}
              {p.destination && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {p.destination}
                </span>
              )}
              {p.visibility !== "family" && (
                <span className="inline-flex items-center gap-1">
                  {p.visibility === "selected" ? <Users className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />} {VIS[p.visibility]}
                </span>
              )}
            </p>
            {r.goalName && r.goalTarget ? (
              <div className="mt-auto pt-1">
                <p className="mb-1 flex items-center gap-1 text-xs text-muted">
                  <PiggyBank className="size-3.5" aria-hidden /> {r.goalName}: ${Math.round((r.goalCurrent ?? 0) / 100).toLocaleString()} of ${Math.round(r.goalTarget / 100).toLocaleString()}
                </p>
                <ProgressBar value={r.goalCurrent ?? 0} max={r.goalTarget} label={`${r.goalName} saved`} />
              </div>
            ) : null}
          </div>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Plans" description="Vacations, trips and big events: itinerary, flights, hotels, cars and a countdown. Each planner chooses who sees their plan." actions={canAdd ? <PlanModal members={members} goals={goalOpts} defaultOpen={sp.new === "1"} /> : undefined} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Plane />} title="Nothing planned yet" description="Start a plan for a vacation, trip or event. Add the itinerary, flights, hotel and car, link a savings goal, and watch the countdown." example="Beach week · Jun 14–21 · Outer Banks · 211 days to go" />
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{upcoming.map(card)}</ul>}
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">Past plans</h2>
              <ul className="grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3">{past.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
