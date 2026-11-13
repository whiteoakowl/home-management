import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { ClipboardList, FileText, Hammer, Wrench } from "lucide-react";
import { db } from "@/db";
import { homeDocuments, homeProjects, homeRepairs, projectStages } from "@/db/schema";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { listChoreTemplates } from "@/lib/chores";
import { occurrencesBetween } from "@/lib/recurrence";
import { addDays, monthLabel, todayIn } from "@/lib/dates";
import { maintViewer } from "../shared";

export const metadata: Metadata = { title: "Home maintenance calendar" };

type Item = { date: string; title: string; href: string; kind: "maintenance" | "repair" | "project" | "warranty" };
const ICON = { maintenance: Wrench, repair: Hammer, project: ClipboardList, warranty: FileText };

export default async function MaintenanceCalendarPage() {
  const viewer = await maintViewer();
  const today = todayIn(viewer.family.timezone);
  const end = addDays(today, 365);
  const fid = viewer.family.id;
  const [occ, repairs, projects, stages, docs] = await Promise.all([
    listChoreTemplates(viewer, ["maintenance"], today),
    db.select().from(homeRepairs).where(and(eq(homeRepairs.familyId, fid), gte(homeRepairs.scheduledOn, today), inArray(homeRepairs.status, ["open", "scheduled"]))),
    db.select().from(homeProjects).where(eq(homeProjects.familyId, fid)),
    db.select({ s: projectStages, title: homeProjects.title }).from(projectStages).innerJoin(homeProjects, eq(homeProjects.id, projectStages.projectId)).where(and(eq(homeProjects.familyId, fid), eq(projectStages.done, false), gte(projectStages.dueOn, today))),
    db.select().from(homeDocuments).where(and(eq(homeDocuments.familyId, fid), gte(homeDocuments.expiresOn, today), lte(homeDocuments.expiresOn, end))),
  ]);
  const items: Item[] = [
    // Project each schedule forward a year (occurrences are only materialised two weeks ahead).
    ...occ.flatMap((t) =>
      (t.rule ? occurrencesBetween(t.rule, today, end).slice(0, 60) : t.nextDue ? [t.nextDue] : []).map((date) => ({ date, title: t.chore.title, href: `/house/chores/${t.chore.id}`, kind: "maintenance" as const })),
    ),
    ...repairs.map((r) => ({ date: r.scheduledOn!, title: `Repair: ${r.title}`, href: `/maintenance/repairs/${r.id}`, kind: "repair" as const })),
    ...projects.flatMap((p) => [
      ...(p.startDate && p.startDate >= today ? [{ date: p.startDate, title: `Start: ${p.title}`, href: `/maintenance/projects/${p.id}`, kind: "project" as const }] : []),
      ...(p.targetDate && p.targetDate >= today && p.status !== "completed" ? [{ date: p.targetDate, title: `Target: ${p.title}`, href: `/maintenance/projects/${p.id}`, kind: "project" as const }] : []),
    ]),
    ...stages.map(({ s, title }) => ({ date: s.dueOn!, title: `${title}: ${s.name}`, href: `/maintenance/projects/${s.projectId}`, kind: "project" as const })),
    ...docs.map((d) => ({ date: d.expiresOn!, title: `Expires: ${d.title}`, href: "/maintenance/documents", kind: "warranty" as const })),
  ]
    .filter((i) => i.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const months = Map.groupBy(items, (i) => i.date.slice(0, 7));
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="Calendar" description="The next 12 months of maintenance, scheduled repairs, project milestones and warranty expirations. Maintenance also appears on the family calendar." />
      <MaintenanceTabs active="calendar" />
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Wrench />} title="Nothing scheduled" description="Add maintenance schedules, repairs and project dates." />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {[...months.entries()].map(([m, list]) => (
            <Card key={m}>
              <h2 className="mb-3 text-lg font-semibold">{monthLabel(`${m}-01`)}</h2>
              <ul className="divide-y divide-line">
                {list.map((i, n) => {
                  const Icon = ICON[i.kind];
                  return (
                    <li key={n}>
                      <Link href={i.href} className="flex items-center gap-3 py-2.5 hover:text-primary-700">
                        <span className="w-24 shrink-0 text-sm text-muted">{fmtDate(i.date)}</span>
                        <Icon className="size-4 shrink-0 text-primary-600" aria-hidden />
                        <span className="font-medium">{i.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
