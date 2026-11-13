import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { DoorOpen } from "lucide-react";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { fileUrl } from "@/lib/files";
import { ROOM_KINDS } from "@/lib/maintenance-config";
import { RoomModal, maintViewer } from "../shared";

export const metadata: Metadata = { title: "Rooms & systems" };

export default async function RoomsPage() {
  const viewer = await maintViewer();
  const rows = await db
    .select({
      r: rooms,
      tasks: sql<number>`(select count(*)::int from chores c where c.room_id = ${rooms.id} and c.kind = 'maintenance' and c.archived_at is null)`,
      repairs: sql<number>`(select count(*)::int from home_repairs h where h.room_id = ${rooms.id})`,
      projects: sql<number>`(select count(*)::int from home_projects p where p.room_id = ${rooms.id})`,
    })
    .from(rooms)
    .where(eq(rooms.familyId, viewer.family.id))
    .orderBy(asc(rooms.sortOrder), asc(rooms.name));
  const canEdit = viewer.can("maintenance", "edit");
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="Rooms, areas & systems" description="Every space and system in the house, with its maintenance, repairs, projects, documents and photos." actions={canEdit && <RoomModal />} />
      <MaintenanceTabs active="rooms" />
      {rows.length === 0 && (
        <Card>
          <EmptyState icon={<DoorOpen />} title="No rooms yet" description="Add rooms, outdoor areas and systems like HVAC, plumbing and the roof." action={canEdit && <RoomModal />} />
        </Card>
      )}
      {ROOM_KINDS.map((k) => {
        const list = rows.filter((x) => x.r.kind === k.value);
        if (!list.length) return null;
        return (
          <section key={k.value} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">{k.value === "system" ? "Home systems" : k.value === "area" ? "Areas" : "Rooms"}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {list.map(({ r, tasks, repairs, projects }) => {
                const img = fileUrl(r.imageFileId, true);
                return (
                  <Link key={r.id} href={`/maintenance/rooms/${r.id}`} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-primary-300">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="aspect-[16/9] w-full object-cover" />
                    )}
                    <div className="p-4">
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-sm text-muted">
                        {tasks} maintenance · {repairs} repairs · {projects} projects
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
