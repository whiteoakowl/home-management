import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { gardenPlans } from "@/db/schema";
import { addPlanting, deleteGardenPlan, removePlanting, saveGardenLayout, updateGardenPlan, updatePlantingQuantity } from "@/app/actions/garden";
import { BlueprintEditor } from "@/components/blueprint/editor";
import { FormModal } from "@/components/forms/action-form";
import { NumberField, TextAreaField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { plantingsWithPlants, plantOptions } from "@/lib/garden";

export const metadata: Metadata = { title: "Garden plan" };

export default async function GardenPlanPage({ params }: PageProps<"/garden/plans/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("garden")) notFound();
  const [plan] = await db.select().from(gardenPlans).where(and(eq(gardenPlans.id, id), eq(gardenPlans.familyId, viewer.family.id)));
  if (!plan) notFound();
  const [plantings, plants] = await Promise.all([plantingsWithPlants(viewer, { planId: id }), plantOptions(viewer)]);
  const canEdit = viewer.can("garden", "edit");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/garden" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Garden
      </Link>
      <PageHeader
        eyebrow={plan.year ? `Garden plan · ${plan.year}` : "Garden plan"}
        title={plan.name}
        description={plan.notes ?? undefined}
        actions={
          canEdit ? (
            <>
              <FormModal title="Plan details" action={updateGardenPlan} size="sm" triggerContent={<><Pencil className="size-4" /> Details</>} triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                <input type="hidden" name="id" value={plan.id} />
                <TextField name="name" label="Name" required defaultValue={plan.name} />
                <NumberField name="year" label="Year" defaultValue={plan.year ?? ""} />
                <TextAreaField name="notes" label="Notes (soil, layout ideas…)" rows={3} defaultValue={plan.notes ?? ""} />
              </FormModal>
              <ActionButton action={deleteGardenPlan} fields={{ id }} confirm="Delete this plan and its plantings?" className="h-9 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
                <Trash2 className="size-4" /> Delete
              </ActionButton>
            </>
          ) : undefined
        }
      />
      <BlueprintEditor
        kind="garden"
        initial={plan.layout}
        canEdit={canEdit}
        onSave={saveGardenLayout.bind(null, id)}
        onAddPlanting={addPlanting.bind(null, id)}
        onUpdatePlanting={updatePlantingQuantity}
        onRemovePlanting={removePlanting}
        plantings={plantings.map((p) => ({ id: p.id, bedKey: p.bedKey, name: p.plantName, imageUrl: p.imageUrl, photoUrl: p.photoUrl, category: p.category, quantity: p.quantity, spacingIn: p.spacingIn }))}
        plants={plants.map((p) => ({ id: p.id, name: p.variety ? `${p.name} · ${p.variety}` : p.name, variety: p.variety, imageUrl: p.imageUrl, photoUrl: p.photoUrl, category: p.category, spacingIn: p.spacingIn }))}
      />
    </div>
  );
}
