import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { deleteHomeDocument, saveHomeDocument, saveHomeProject, saveHomeRoom, saveRepair } from "@/app/actions/maintenance";
import { RecordModal } from "@/components/forms/config-form";
import type { MemberOption } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { fmtDate } from "@/components/records/detail-list";
import { Badge } from "@/components/ui/display";
import type { homeDocuments, homeProjects, homeRepairs, rooms } from "@/db/schema";
import { getViewer } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { DOC_FIELDS, DOC_TYPES, PROJECT_FIELDS, REPAIR_FIELDS, ROOM_FIELDS } from "@/lib/maintenance-config";
import type { FieldDef, FieldValue } from "@/lib/record-fields";

export async function maintViewer() {
  const viewer = await getViewer();
  if (!viewer.can("maintenance")) redirect("/");
  return viewer;
}

type Opt = { value: string; label: string };
const withOptions = (fields: FieldDef[], o: Record<string, Opt[]>) => fields.map((f) => (o[f.name] ? { ...f, options: o[f.name] } : f));
const pick = (fields: FieldDef[], r: Record<string, unknown>) => Object.fromEntries(fields.map((f) => [f.name, r[f.name] as FieldValue]));

export function RoomModal({ room, defaultKind }: { room?: typeof rooms.$inferSelect; defaultKind?: string }) {
  return (
    <RecordModal
      title={room ? `Edit ${room.name}` : "Add room, area or system"}
      triggerLabel={room ? "Edit" : "Add room or system"}
      triggerVariant={room ? "secondary" : "primary"}
      size="md"
      action={saveHomeRoom}
      fields={ROOM_FIELDS}
      defaults={room ? pick(ROOM_FIELDS, room) : { kind: defaultKind ?? "room" }}
      hidden={room ? { id: room.id } : {}}
      imageUrls={{ image: room ? fileUrl(room.imageFileId) : null }}
    />
  );
}

export function ProjectModal({ p, rooms, members, defaults }: { p?: typeof homeProjects.$inferSelect; rooms: Opt[]; members: MemberOption[]; defaults?: Record<string, FieldValue> }) {
  return (
    <RecordModal
      title={p ? "Edit project" : "New remodeling project"}
      triggerLabel={p ? "Edit" : "New project"}
      triggerVariant={p ? "secondary" : "primary"}
      action={saveHomeProject}
      fields={withOptions(PROJECT_FIELDS, { roomId: rooms })}
      defaults={p ? pick(PROJECT_FIELDS, p) : { status: "idea", ...defaults }}
      hidden={p ? { id: p.id } : {}}
      members={members}
      imageUrls={{ image: p ? fileUrl(p.coverFileId) : null }}
    />
  );
}

export function RepairModal({ r, rooms, canBudget, today, defaults }: { r?: typeof homeRepairs.$inferSelect; rooms: Opt[]; canBudget: boolean; today: string; defaults?: Record<string, FieldValue> }) {
  const budget: FieldDef[] = canBudget && !r?.costCents ? [{ name: "addToBudget", label: "Record the cost in the budget (Home repairs)", type: "checkbox" }] : [];
  return (
    <RecordModal
      title={r ? "Edit repair" : "Log a repair"}
      triggerLabel={r ? "Edit" : "Log repair"}
      triggerVariant={r ? "secondary" : "primary"}
      action={saveRepair}
      fields={[...withOptions(REPAIR_FIELDS, { roomId: rooms }), ...budget]}
      defaults={r ? pick(REPAIR_FIELDS, r) : { status: "open", reportedOn: today, ...defaults }}
      hidden={r ? { id: r.id } : {}}
    />
  );
}

type Doc = typeof homeDocuments.$inferSelect;

export function DocModal({ d, rooms, projects, members, defaults, soft }: { d?: Doc; rooms: Opt[]; projects: Opt[]; members: MemberOption[]; defaults?: Record<string, FieldValue>; soft?: boolean }) {
  return (
    <RecordModal
      title={d ? "Edit document" : "Add document or warranty"}
      triggerLabel={d ? "Edit" : "Add document"}
      triggerVariant={d ? undefined : soft ? "soft" : "primary"}
      edit={!!d}
      action={saveHomeDocument}
      fields={withOptions(DOC_FIELDS, { roomId: rooms, projectId: projects })}
      defaults={d ? pick(DOC_FIELDS, d) : { docType: "warranty", ...defaults }}
      hidden={d ? { id: d.id } : {}}
      members={members}
      visibility={{ defaultValue: d?.visibility ?? "family" }}
    />
  );
}

export function DocRow({ d, rooms, projects, members, canEdit, today }: { d: Doc; rooms: Opt[]; projects: Opt[]; members: MemberOption[]; canEdit: boolean; today: string }) {
  const expired = d.expiresOn && d.expiresOn < today;
  const soon = d.expiresOn && !expired && d.expiresOn <= new Date(Date.parse(`${today}T12:00:00Z`) + 60 * 864e5).toISOString().slice(0, 10);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <FileText className="size-5" aria-hidden />
      </span>
      <div className="min-w-48 flex-1">
        <p className="font-medium">
          {d.fileId ? (
            <a href={fileUrl(d.fileId)!} target="_blank" rel="noreferrer" className="hover:text-primary-700 hover:underline">
              {d.title}
            </a>
          ) : (
            d.title
          )}{" "}
          <Badge tone="primary">{DOC_TYPES.find((t) => t.value === d.docType)?.label ?? d.docType}</Badge>
        </p>
        <p className="text-sm text-muted">
          {[d.applianceName, rooms.find((r) => r.value === d.roomId)?.label, projects.find((p) => p.value === d.projectId)?.label, d.notes].filter(Boolean).join(" · ")}
        </p>
      </div>
      {d.expiresOn && <Badge tone={expired ? "wine" : soon ? "olive" : "neutral"}>{expired ? "Expired" : "Expires"} {fmtDate(d.expiresOn)}</Badge>}
      {canEdit && (
        <div className="flex">
          <DocModal d={d} rooms={rooms} projects={projects} members={members} />
          <DeleteButton action={deleteHomeDocument} fields={{ id: d.id }} what={`"${d.title}"`} />
        </div>
      )}
    </li>
  );
}
