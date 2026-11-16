import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { db } from "@/db";
import { homeProjects } from "@/db/schema";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { fileUrl } from "@/lib/files";
import { roomOpts } from "@/lib/maintenance";
import { PROJECT_STATUSES, PROJECT_STATUS_TONE } from "@/lib/maintenance-config";
import { memberOptions } from "@/lib/queries";
import { ProjectModal, projectsViewer } from "../shared";

export const metadata: Metadata = { title: "Remodeling projects" };

export default async function ProjectsPage({ searchParams }: PageProps<"/maintenance/projects">) {
  const viewer = await projectsViewer();
  const sp = await searchParams;
  const [members, rooms, rows] = await Promise.all([
    memberOptions(viewer),
    roomOpts(viewer),
    db
      .select({
        p: homeProjects,
        stages: sql<number>`(select count(*)::int from project_stages s where s.project_id = ${homeProjects.id})`,
        done: sql<number>`(select count(*)::int from project_stages s where s.project_id = ${homeProjects.id} and s.done)`,
        spent: sql<number>`coalesce((select sum(amount_cents) from transactions t where t.project_id = ${homeProjects.id}),0)::int`,
      })
      .from(homeProjects)
      .where(and(eq(homeProjects.familyId, viewer.family.id)))
      .orderBy(asc(homeProjects.targetDate)),
  ]);
  const canEdit = viewer.can("projects", "edit");
  const add = canEdit ? <ProjectModal rooms={rooms} members={members} defaultOpen={sp.new === "1"} /> : undefined;
  // Active = everything not finished, with work under way first.
  const view = sp.view === "completed" || sp.view === "all" ? sp.view : "active";
  const ORDER = ["in_progress", "ready", "on_hold", "budgeting", "planning", "idea", "completed"];
  const statuses = [...PROJECT_STATUSES].sort((a, b) => ORDER.indexOf(a.value) - ORDER.indexOf(b.value)).filter((s) => (view === "all" ? true : view === "completed" ? s.value === "completed" : s.value !== "completed"));
  const counts = { active: rows.filter((r) => r.p.status !== "completed").length, completed: rows.filter((r) => r.p.status === "completed").length, all: rows.length };
  const groups = statuses.map((s) => ({ ...s, list: rows.filter((r) => r.p.status === s.value) })).filter((g) => g.list.length);
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="Remodeling projects" description="From idea to completed: stages, tasks, materials, budget, expenses and photos." actions={add} />
      <MaintenanceTabs active="projects" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList />} title="No projects yet" description="Capture ideas early; move them through planning and budgeting when you're ready." action={canEdit && <ProjectModal rooms={rooms} members={members} />} />
        </Card>
      ) : (
        <>
          <SegmentLinks
            fit
            active={view}
            items={[
              { key: "active", href: "/maintenance/projects", label: `Active (${counts.active})` },
              { key: "completed", href: "/maintenance/projects?view=completed", label: `Completed (${counts.completed})` },
              { key: "all", href: "/maintenance/projects?view=all", label: `All (${counts.all})` },
            ]}
          />
          {groups.length === 0 ? (
            <Card className="mt-5">
              <EmptyState icon={<ClipboardList />} title={view === "completed" ? "No completed projects yet" : "No active projects"} description={view === "completed" ? "Finished projects show here." : "Every project is marked completed. Start a new one any time."} />
            </Card>
          ) : (
            <div className="mt-5 flex flex-col gap-6">
              {groups.map((g) => (
                <section key={g.value} aria-label={g.label}>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
                    {g.label} <span className="rounded-full bg-sunken px-2 text-xs">{g.list.length}</span>
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.list.map(({ p, stages, done, spent }) => {
                      const img = fileUrl(p.coverFileId, true);
                      return (
                        <li key={p.id}>
                          <Link href={`/maintenance/projects/${p.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-primary-300">
                            {img && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt="" className="aspect-[16/9] w-full object-cover" />
                            )}
                            <div className="flex flex-col gap-1.5 p-4">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold">{p.title}</p>
                                <Badge tone={PROJECT_STATUS_TONE[p.status] ?? "neutral"}>{g.label}</Badge>
                              </div>
                              <p className="text-sm text-muted">{[rooms.find((r) => r.value === p.roomId)?.label, p.targetDate ? `Target ${fmtDate(p.targetDate)}` : null].filter(Boolean).join(" · ")}</p>
                              {stages > 0 && <ProgressBar value={done} max={stages} label={`${done}/${stages} stages`} />}
                              {(p.budgetCents || spent > 0) && (
                                <p className="text-xs text-muted">
                                  {fmtMoney(spent)} spent{p.budgetCents ? ` of ${fmtMoney(p.budgetCents)}` : ""}
                                </p>
                              )}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
