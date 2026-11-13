import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { files, vendors, homeDocuments, homePhotos, homeProjects, homeRepairs, projectMaterials, projectStages, rooms, transactions } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";

export const roomOpts = async (viewer: Viewer) =>
  (await db.select({ id: rooms.id, name: rooms.name, kind: rooms.kind }).from(rooms).where(eq(rooms.familyId, viewer.family.id)).orderBy(asc(rooms.kind), asc(rooms.sortOrder), asc(rooms.name))).map((r) => ({
    value: r.id,
    label: r.kind === "system" ? `${r.name} (system)` : r.name,
  }));

export const vendorOpts = async (viewer: Viewer) =>
  (await db.select({ id: vendors.id, name: vendors.name, trade: vendors.trade }).from(vendors).where(eq(vendors.familyId, viewer.family.id)).orderBy(asc(vendors.name))).map((v) => ({ value: v.id, label: v.trade ? `${v.name} (${v.trade.replace(/_/g, " ")})` : v.name }));

export const projectOpts = async (viewer: Viewer) =>
  (await db.select({ id: homeProjects.id, title: homeProjects.title }).from(homeProjects).where(eq(homeProjects.familyId, viewer.family.id)).orderBy(asc(homeProjects.title))).map((p) => ({ value: p.id, label: p.title }));

export async function getProject(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db.select().from(homeProjects).where(and(eq(homeProjects.id, id), eq(homeProjects.familyId, viewer.family.id)));
  return p ?? null;
}

export async function getRepair(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select().from(homeRepairs).where(and(eq(homeRepairs.id, id), eq(homeRepairs.familyId, viewer.family.id)));
  return r ?? null;
}

export async function projectDetail(viewer: Viewer, id: string) {
  const [stages, materials, photos, docs, spent] = await Promise.all([
    db.select().from(projectStages).where(eq(projectStages.projectId, id)).orderBy(asc(projectStages.position), asc(projectStages.createdAt)),
    db.select().from(projectMaterials).where(eq(projectMaterials.projectId, id)).orderBy(asc(projectMaterials.purchased), asc(projectMaterials.name)),
    photosFor(viewer, { projectId: id }),
    visibleDocs(viewer, { projectId: id }),
    db
      .select({ id: transactions.id, name: transactions.name, amountCents: transactions.amountCents, date: transactions.date })
      .from(transactions)
      .where(and(eq(transactions.familyId, viewer.family.id), eq(transactions.projectId, id)))
      .orderBy(desc(transactions.date)),
  ]);
  return { stages, materials, photos, docs, expenses: spent };
}

export async function photosFor(viewer: Viewer, t: { projectId?: string; repairId?: string; roomId?: string }) {
  return db
    .select({ id: homePhotos.id, fileId: homePhotos.fileId, kind: homePhotos.kind, caption: homePhotos.caption, mime: files.mimeType })
    .from(homePhotos)
    .innerJoin(files, eq(files.id, homePhotos.fileId))
    .where(
      and(
        eq(homePhotos.familyId, viewer.family.id),
        t.projectId ? eq(homePhotos.projectId, t.projectId) : undefined,
        t.repairId ? eq(homePhotos.repairId, t.repairId) : undefined,
        t.roomId ? eq(homePhotos.roomId, t.roomId) : undefined,
      ),
    )
    .orderBy(desc(homePhotos.createdAt));
}

export function visibleDocs(viewer: Viewer, opts: { roomId?: string; projectId?: string } = {}) {
  return db
    .select()
    .from(homeDocuments)
    .where(
      and(
        eq(homeDocuments.familyId, viewer.family.id),
        visibleTo(viewer, { id: homeDocuments.id, visibility: homeDocuments.visibility, author: homeDocuments.createdByMemberId }, "document"),
        opts.roomId ? eq(homeDocuments.roomId, opts.roomId) : undefined,
        opts.projectId ? eq(homeDocuments.projectId, opts.projectId) : undefined,
      ),
    )
    .orderBy(sql`${homeDocuments.expiresOn} asc nulls last`, asc(homeDocuments.title));
}

/** Money spent on the home this year: maintenance actual costs + repairs + project expenses. */
export async function homeSpendThisYear(viewer: Viewer, year: string) {
  const fid = viewer.family.id;
  const [row] = await db.execute<{ maint: number; repairs: number; projects: number }>(sql`
    select
      coalesce((select sum(o.actual_cost_cents) from chore_occurrences o join chores c on c.id = o.chore_id where c.family_id = ${fid} and c.kind = 'maintenance' and o.due_date >= ${`${year}-01-01`}), 0)::int as maint,
      coalesce((select sum(cost_cents) from home_repairs where family_id = ${fid} and coalesce(completed_on, reported_on) >= ${`${year}-01-01`}), 0)::int as repairs,
      coalesce((select sum(amount_cents) from transactions where family_id = ${fid} and project_id is not null and date >= ${`${year}-01-01`}), 0)::int as projects
  `).then((r) => r.rows);
  return row ?? { maint: 0, repairs: 0, projects: 0 };
}

