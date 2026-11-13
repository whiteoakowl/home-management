import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ClipboardList, FileText, Hammer, Wrench } from "lucide-react";
import { db } from "@/db";
import { homeProjects, homeRepairs, lists, rooms } from "@/db/schema";
import { deleteHomeRoom } from "@/app/actions/maintenance";
import { DeleteButton } from "@/components/forms/inline";
import { ChoreFormModal } from "@/components/house/chore-form";
import { TemplateBoard } from "@/components/house/template-board";
import { AddPhotosModal, PhotoGallery } from "@/components/maintenance/photos";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { listChoreTemplates } from "@/lib/chores";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { photosFor, projectOpts, roomOpts, vendorOpts, visibleDocs } from "@/lib/maintenance";
import { PROJECT_STATUSES, PROJECT_STATUS_TONE, ROOM_KINDS } from "@/lib/maintenance-config";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { DocModal, DocRow, ProjectModal, RepairModal, RoomModal, maintViewer } from "../../shared";

export const metadata: Metadata = { title: "Room" };

export default async function RoomPage({ params }: PageProps<"/maintenance/rooms/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await maintViewer();
  const [room] = await db.select().from(rooms).where(and(eq(rooms.id, id), eq(rooms.familyId, viewer.family.id)));
  if (!room) notFound();
  const today = todayIn(viewer.family.timezone);
  const canEdit = viewer.can("maintenance", "edit");
  const [vendors, members, rOpts, pOpts, choreRooms, cats, templates, repairs, projects, docs, photos, todo] = await Promise.all([
    vendorOpts(viewer),
    memberOptions(viewer),
    roomOpts(viewer),
    projectOpts(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "household"),
    listChoreTemplates(viewer, ["maintenance"], today),
    db.select().from(homeRepairs).where(and(eq(homeRepairs.familyId, viewer.family.id), eq(homeRepairs.roomId, room.id))).orderBy(desc(homeRepairs.reportedOn)),
    db.select().from(homeProjects).where(and(eq(homeProjects.familyId, viewer.family.id), eq(homeProjects.roomId, room.id))).orderBy(desc(homeProjects.createdAt)),
    visibleDocs(viewer, { roomId: room.id }),
    photosFor(viewer, { roomId: room.id }),
    db.select().from(lists).where(and(eq(lists.familyId, viewer.family.id), eq(lists.roomId, room.id))),
  ]);
  const mine = templates.filter((t) => t.chore.roomId === room.id);
  const img = fileUrl(room.imageFileId);
  return (
    <div className="flex flex-col gap-6">
      <Link href="/maintenance/rooms" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Rooms & systems
      </Link>
      <MaintenanceTabs active="rooms" />
      <PageHeader
        eyebrow={ROOM_KINDS.find((k) => k.value === room.kind)?.label}
        title={room.name}
        description={room.description ?? undefined}
        actions={
          canEdit && (
            <>
              <RoomModal room={room} />
              <DeleteButton action={deleteHomeRoom} fields={{ id: room.id }} what={room.name} />
            </>
          )
        }
      />
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={room.name} className="max-h-72 w-full rounded-[var(--radius-card)] object-cover" />
      )}
      {room.notes && <Card className="text-sm whitespace-pre-line">{room.notes}</Card>}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wrench className="size-5 text-primary-600" aria-hidden /> Maintenance
          </h2>
          {canEdit && <ChoreFormModal kind="maintenance" members={members} rooms={choreRooms} categories={cats} label="Add maintenance" presetRoomId={room.id} />}
        </div>
        <TemplateBoard today={today} groups={[{ key: "all", label: "", items: mine }]} empty={<p className="text-sm text-muted">No maintenance scheduled for this space.</p>} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Repairs" icon={<Hammer className="size-4" />} action={canEdit && <RepairModal rooms={rOpts} vendors={vendors} canBudget={viewer.can("budget", "edit")} today={today} defaults={{ roomId: room.id }} />} />
          {repairs.length ? (
            <ul className="divide-y divide-line">
              {repairs.map((r) => (
                <li key={r.id}>
                  <Link href={`/maintenance/repairs/${r.id}`} className="flex justify-between gap-3 py-2.5 hover:text-primary-700">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-sm text-muted">
                      {r.status} · {fmtDate(r.completedOn ?? r.reportedOn)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No repairs logged.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Projects" icon={<ClipboardList className="size-4" />} action={canEdit && <ProjectModal rooms={rOpts} members={members} defaults={{ roomId: room.id }} />} />
          {projects.length ? (
            <ul className="divide-y divide-line">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/maintenance/projects/${p.id}`} className="flex justify-between gap-3 py-2.5 hover:text-primary-700">
                    <span className="font-medium">{p.title}</span>
                    <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUSES.find((s) => s.value === p.status)?.label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No projects for this space.</p>
          )}
          {todo.length > 0 && (
            <p className="mt-3 text-sm">
              To-do lists:{" "}
              {todo.map((l, i) => (
                <span key={l.id}>
                  {i > 0 && ", "}
                  <Link href={`/lists/${l.id}`} className="font-medium text-primary-700 underline">
                    {l.title}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Documents & warranties" icon={<FileText className="size-4" />} action={canEdit && <DocModal soft rooms={rOpts} projects={pOpts} members={members} defaults={{ roomId: room.id }} />} />
        {docs.length ? (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <DocRow key={d.id} d={d} rooms={rOpts} projects={pOpts} members={members} canEdit={canEdit} today={today} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Manuals, warranties, paint colors and product info for this space.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Photos" action={canEdit && <AddPhotosModal target={{ roomId: room.id }} />} />
        <PhotoGallery photos={photos} canEdit={canEdit} />
      </Card>
    </div>
  );
}
