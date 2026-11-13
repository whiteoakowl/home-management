import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { createHomeTodoList } from "@/app/actions/maintenance";
import { FormModal } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/fields";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { db } from "@/db";
import { lists } from "@/db/schema";
import { projectOpts, roomOpts } from "@/lib/maintenance";
import { maintViewer } from "../shared";

export const metadata: Metadata = { title: "Home to-do lists" };

export default async function HomeTodoPage() {
  const viewer = await maintViewer();
  const [rooms, projects, rows] = await Promise.all([
    roomOpts(viewer),
    projectOpts(viewer),
    viewer.can("lists")
      ? db
          .select({
            l: lists,
            total: sql<number>`(select count(*)::int from list_items i where i.list_id = ${lists.id})`,
            done: sql<number>`(select count(*)::int from list_items i where i.list_id = ${lists.id} and i.checked)`,
          })
          .from(lists)
          .where(and(eq(lists.familyId, viewer.family.id), isNull(lists.archivedAt), or(isNotNull(lists.roomId), isNotNull(lists.projectId)), sql`${lists.kind} <> 'shopping'`))
          .orderBy(asc(lists.title))
      : Promise.resolve([]),
  ]);
  const canCreate = viewer.can("maintenance", "edit") && viewer.can("lists", "edit");
  const add = canCreate ? (
    <FormModal title="New home to-do list" action={createHomeTodoList} triggerLabel="New list" size="md" description="Lists live in Lists too, so everyone can check items off.">
      <TextField name="title" label="List" placeholder="Garage clean-out" required />
      <SelectField name="roomId" label="Room / system" options={rooms} placeholder="—" />
      <SelectField name="projectId" label="…or project" options={projects} placeholder="—" />
    </FormModal>
  ) : undefined;
  const label = (l: (typeof rows)[number]["l"]) => projects.find((p) => p.value === l.projectId)?.label ?? rooms.find((r) => r.value === l.roomId)?.label;
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="To-do lists" description="Checklists for rooms, systems and projects: punch lists, clean-outs, seasonal prep." actions={add} />
      <MaintenanceTabs active="todo" />
      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ l, total, done }) => (
            <Link key={l.id} href={`/lists/${l.id}`} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
              <p className="font-semibold">{l.title}</p>
              <p className="text-sm text-muted">{label(l)}</p>
              <ProgressBar value={done} max={Math.max(1, total)} label={`${done}/${total} done`} />
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<ClipboardList />} title="No home to-do lists" description="Create a list for a room, system or project." action={add} />
        </Card>
      )}
    </>
  );
}
