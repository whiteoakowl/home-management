import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { db } from "@/db";
import { homeProjects } from "@/db/schema";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { fileUrl } from "@/lib/files";
import { roomOpts } from "@/lib/maintenance";
import { PROJECT_STATUSES } from "@/lib/maintenance-config";
import { memberOptions } from "@/lib/queries";
import { ProjectModal, maintViewer } from "../shared";

export const metadata: Metadata = { title: "Remodeling projects" };

export default async function ProjectsPage({ searchParams }: PageProps<"/maintenance/projects">) {
  const viewer = await maintViewer();
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
  const canEdit = viewer.can("maintenance", "edit");
  const add = canEdit ? <ProjectModal rooms={rooms} members={members} defaultOpen={sp.new === "1"} /> : undefined;
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="Remodeling projects" description="From idea to completed: stages, tasks, materials, budget, expenses and photos." actions={add} />
      <MaintenanceTabs active="projects" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList />} title="No projects yet" description="Capture ideas early; move them through planning and budgeting when you're ready." action={canEdit && <ProjectModal rooms={rooms} members={members} />} />
        </Card>
      ) : (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
          {PROJECT_STATUSES.map((s) => {
            const list = rows.filter((r) => r.p.status === s.value);
            return (
              <section key={s.value} className="flex w-72 shrink-0 flex-col gap-3" aria-label={s.label}>
                <h2 className="flex items-center justify-between text-sm font-semibold tracking-wide text-muted uppercase">
                  {s.label} <span className="rounded-full bg-sunken px-2 text-xs">{list.length}</span>
                </h2>
                {list.map(({ p, stages, done, spent }) => {
                  const img = fileUrl(p.coverFileId, true);
                  return (
                    <Link key={p.id} href={`/maintenance/projects/${p.id}`} className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-primary-300">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="aspect-[16/9] w-full object-cover" />
                      )}
                      <div className="flex flex-col gap-1.5 p-4 pt-2">
                        <p className="font-semibold">{p.title}</p>
                        <p className="text-sm text-muted">{[rooms.find((r) => r.value === p.roomId)?.label, p.targetDate ? `Target ${fmtDate(p.targetDate)}` : null].filter(Boolean).join(" · ")}</p>
                        {stages > 0 && <ProgressBar value={done} max={stages} label={`${done}/${stages} stages`} />}
                        {(p.budgetCents || spent > 0) && (
                          <p className="text-xs text-muted">
                            {fmtMoney(spent)} spent{p.budgetCents ? ` of ${fmtMoney(p.budgetCents)}` : ""}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
