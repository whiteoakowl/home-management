import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { projectOpts, roomOpts, visibleDocs } from "@/lib/maintenance";
import { DOC_TYPES } from "@/lib/maintenance-config";
import { memberOptions } from "@/lib/queries";
import { DocModal, DocRow, maintViewer } from "../shared";

export const metadata: Metadata = { title: "Documents & warranties" };

export default async function DocumentsPage({ searchParams }: PageProps<"/maintenance/documents">) {
  const viewer = await maintViewer();
  const sp = (await searchParams) as { type?: string; room?: string; q?: string; expiring?: string };
  const today = todayIn(viewer.family.timezone);
  const [members, rooms, projects, docs] = await Promise.all([memberOptions(viewer), roomOpts(viewer), projectOpts(viewer), visibleDocs(viewer)]);
  const soon = new Date(Date.parse(`${today}T12:00:00Z`) + 90 * 864e5).toISOString().slice(0, 10);
  const q = sp.q?.toLowerCase();
  const shown = docs.filter(
    (d) =>
      (!sp.type || d.docType === sp.type) &&
      (!sp.room || d.roomId === sp.room) &&
      (!sp.expiring || (d.expiresOn && d.expiresOn <= soon)) &&
      (!q || `${d.title} ${d.applianceName} ${d.notes}`.toLowerCase().includes(q)),
  );
  const canEdit = viewer.can("maintenance", "edit");
  const add = canEdit ? <DocModal rooms={rooms} projects={projects} members={members} /> : undefined;
  const sel = "h-10 rounded-full border border-line-strong bg-surface px-3 text-sm";
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="Documents & warranties" description="Manuals, warranties, estimates, receipts, plans, inspections and paint colors. Expiring warranties get a reminder 30 days ahead." actions={add} />
      <MaintenanceTabs active="documents" />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search documents…" aria-label="Search documents" className="h-10 min-w-48 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm" />
        <select name="type" defaultValue={sp.type ?? ""} aria-label="Type" className={sel}>
          <option value="">All types</option>
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select name="room" defaultValue={sp.room ?? ""} aria-label="Room" className={sel}>
          <option value="">Every room</option>
          {rooms.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-sm">
          <input type="checkbox" name="expiring" value="1" defaultChecked={!!sp.expiring} /> Expiring in 90 days
        </label>
        <button className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white">Filter</button>
      </form>
      {shown.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {shown.map((d) => (
              <DocRow key={d.id} d={d} rooms={rooms} projects={projects} members={members} canEdit={canEdit} today={today} />
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState icon={<FileText />} title={docs.length ? "No documents match" : "No documents yet"} description="Upload manuals and warranties so they're there when something breaks." action={!docs.length && add} />
        </Card>
      )}
    </>
  );
}
