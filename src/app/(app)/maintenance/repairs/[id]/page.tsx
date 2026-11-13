import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { deleteRepair } from "@/app/actions/maintenance";
import { DeleteButton } from "@/components/forms/inline";
import { AddPhotosModal, PhotoGallery } from "@/components/maintenance/photos";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { DetailList } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { getRepair, photosFor, roomOpts } from "@/lib/maintenance";
import { REPAIR_FIELDS } from "@/lib/maintenance-config";
import { RepairModal, maintViewer } from "../../shared";

export const metadata: Metadata = { title: "Repair" };

export default async function RepairPage({ params }: PageProps<"/maintenance/repairs/[id]">) {
  const { id } = await params;
  const viewer = await maintViewer();
  const r = await getRepair(viewer, id);
  if (!r) notFound();
  const today = todayIn(viewer.family.timezone);
  const canEdit = viewer.can("maintenance", "edit");
  const [rooms, photos] = await Promise.all([roomOpts(viewer), photosFor(viewer, { repairId: r.id })]);
  const fields = REPAIR_FIELDS.map((f) => (f.name === "roomId" ? { ...f, options: rooms } : f));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/maintenance/repairs" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Repair log
      </Link>
      <MaintenanceTabs active="repairs" />
      <PageHeader
        eyebrow={<Badge tone={r.status === "completed" ? "primary" : r.status === "scheduled" ? "olive" : "wine"}>{r.status}</Badge>}
        title={r.title}
        actions={
          canEdit && (
            <>
              <RepairModal r={r} rooms={rooms} canBudget={viewer.can("budget", "edit")} today={today} />
              <DeleteButton action={deleteRepair} fields={{ id: r.id }} what={`"${r.title}"`} />
            </>
          )
        }
      />
      {r.warrantyExpiresOn && (
        <p className={r.warrantyExpiresOn < today ? "rounded-xl bg-sunken px-4 py-2 text-sm text-muted" : "rounded-xl bg-olive-50 px-4 py-2 text-sm text-olive-700"}>
          {r.warrantyExpiresOn < today ? "Warranty expired" : "Under warranty"} until {r.warrantyExpiresOn}
          {r.warrantyInfo && ` · ${r.warrantyInfo}`}
        </p>
      )}
      <Card>
        <DetailList fields={fields} values={r as never} skip={["title", "status"]} />
      </Card>
      <Card>
        <CardHeader title="Before, after & receipts" action={canEdit && <AddPhotosModal target={{ repairId: r.id }} kinds={["before", "after", "receipt", "progress"]} defaultKind="before" />} />
        <PhotoGallery photos={photos} canEdit={canEdit} empty="Add before and after photos and the receipt." />
      </Card>
    </div>
  );
}
