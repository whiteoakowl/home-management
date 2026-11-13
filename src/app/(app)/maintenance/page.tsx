import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray, lte, ne } from "drizzle-orm";
import { CalendarClock, ClipboardList, DoorOpen, FileText, Hammer, ShieldCheck, Wrench } from "lucide-react";
import { db } from "@/db";
import { homeDocuments, homeProjects, homeRepairs, rooms } from "@/db/schema";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/display";
import { listOccurrences } from "@/lib/chores";
import { addDays, todayIn } from "@/lib/dates";
import { homeSpendThisYear } from "@/lib/maintenance";
import { PROJECT_STATUSES, PROJECT_STATUS_TONE } from "@/lib/maintenance-config";
import { memberOptions } from "@/lib/queries";
import { maintViewer } from "./shared";

export const metadata: Metadata = { title: "Home Maintenance" };

export default async function MaintenanceDashboard() {
  const viewer = await maintViewer();
  const today = todayIn(viewer.family.timezone);
  const fid = viewer.family.id;
  const [members, due, overdue, projects, repairs, docs, roomCount, spend] = await Promise.all([
    memberOptions(viewer),
    listOccurrences(viewer, { kinds: ["maintenance"], from: today, to: addDays(today, 30), statuses: ["pending"] }),
    listOccurrences(viewer, { kinds: ["maintenance"], to: addDays(today, -1), statuses: ["pending", "missed"], order: "desc", limit: 20 }),
    db.select().from(homeProjects).where(and(eq(homeProjects.familyId, fid), ne(homeProjects.status, "completed"))).orderBy(asc(homeProjects.targetDate)),
    db.select().from(homeRepairs).where(and(eq(homeRepairs.familyId, fid), inArray(homeRepairs.status, ["open", "scheduled"]))).orderBy(asc(homeRepairs.reportedOn)),
    db.select().from(homeDocuments).where(and(eq(homeDocuments.familyId, fid), lte(homeDocuments.expiresOn, addDays(today, 90)))).orderBy(asc(homeDocuments.expiresOn)).limit(5),
    db.$count(rooms, eq(rooms.familyId, fid)),
    homeSpendThisYear(viewer, today.slice(0, 4)),
  ]);
  const total = spend.maint + spend.repairs + spend.projects;
  const tiles = [
    { href: "/maintenance/rooms", label: "Rooms & systems", icon: DoorOpen, stat: `${roomCount} tracked` },
    { href: "/maintenance/schedule", label: "Schedule", icon: Wrench, stat: `${due.length} due in 30 days` },
    { href: "/maintenance/repairs", label: "Repairs", icon: Hammer, stat: `${repairs.length} open` },
    { href: "/maintenance/projects", label: "Projects", icon: ClipboardList, stat: `${projects.length} active` },
    { href: "/maintenance/documents", label: "Warranties", icon: ShieldCheck, stat: `${docs.length} expiring soon` },
    { href: "/maintenance/calendar", label: "Calendar", icon: CalendarClock, stat: "All home dates" },
  ];
  return (
    <>
      <PageHeader eyebrow="Household" title="Home Maintenance & Remodeling" description="Keep the house in good repair: schedules, repairs, projects and the paperwork that goes with them." />
      <MaintenanceTabs active="dashboard" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <t.icon className="size-5" aria-hidden />
            </span>
            <span className="font-medium">{t.label}</span>
            <span className="text-sm text-muted">{t.stat}</span>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Maintenance due" icon={<Wrench className="size-4" />} href="/maintenance/schedule" />
          {overdue.length > 0 && (
            <>
              <p className="mb-2 text-sm font-medium text-wine-600">Overdue</p>
              <OccurrenceList items={overdue.slice(0, 5)} today={today} members={members} canManage={viewer.can("maintenance", "edit")} />
              <p className="mt-4 mb-2 text-sm font-medium text-muted">Next 30 days</p>
            </>
          )}
          {due.length ? <OccurrenceList items={due.slice(0, 8)} today={today} members={members} canManage={viewer.can("maintenance", "edit")} /> : <p className="text-sm text-muted">Nothing due in the next 30 days.</p>}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Active projects" icon={<ClipboardList className="size-4" />} href="/maintenance/projects" />
            {projects.length ? (
              <ul className="divide-y divide-line">
                {projects.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link href={`/maintenance/projects/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary-700">
                      <span className="font-medium">{p.title}</span>
                      <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUSES.find((s) => s.value === p.status)?.label ?? p.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No projects underway.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Open repairs" icon={<Hammer className="size-4" />} href="/maintenance/repairs" />
            {repairs.length ? (
              <ul className="divide-y divide-line">
                {repairs.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link href={`/maintenance/repairs/${r.id}`} className="flex justify-between gap-3 py-2.5 hover:text-primary-700">
                      <span className="font-medium">{r.title}</span>
                      <span className="text-sm text-muted">{r.scheduledOn ? `Scheduled ${fmtDate(r.scheduledOn)}` : `Reported ${fmtDate(r.reportedOn)}`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing needs fixing. 🎉</p>
            )}
          </Card>
          <Card>
            <CardHeader title={`Spent on the home in ${today.slice(0, 4)}`} />
            <p className="font-display text-3xl font-semibold">{fmtMoney(total)}</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {[
                ["Maintenance", spend.maint],
                ["Repairs", spend.repairs],
                ["Projects", spend.projects],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <div className="flex justify-between">
                    <span>{l}</span>
                    <span className="text-muted">{fmtMoney(v as number)}</span>
                  </div>
                  <ProgressBar value={v as number} max={Math.max(1, total)} tone={l === "Repairs" ? "wine" : l === "Projects" ? "olive" : "primary"} />
                </div>
              ))}
            </div>
          </Card>
          {docs.length > 0 && (
            <Card>
              <CardHeader title="Warranties & documents expiring" icon={<FileText className="size-4" />} href="/maintenance/documents" />
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span className="font-medium">{d.title}</span>
                    <span className={d.expiresOn! < today ? "text-wine-600" : "text-muted"}>{fmtDate(d.expiresOn)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
