import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { farmPlans } from "@/db/schema";
import { deleteFarmPlan, saveFarmLayout, updateFarmPlan } from "@/app/actions/farm";
import { FormModal } from "@/components/forms/action-form";
import { TextAreaField, TextField, VisibilityField } from "@/components/forms/fields";
import { PlanEyebrow } from "@/components/blueprint/plan-eyebrow";
import { BlueprintEditor } from "@/components/blueprint/editor";
import { ActionButton } from "@/components/forms/inline";
import { PageHeader } from "@/components/ui/display";
import { canChangeItem, getViewer } from "@/lib/dal";
import { farmPlanVisible } from "@/lib/plans";
import { getRecordAccess } from "@/lib/records";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Farm map" };

export default async function FarmPlanPage({ params }: PageProps<"/farm/plans/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const [plan] = await db.select().from(farmPlans).where(and(eq(farmPlans.id, id), eq(farmPlans.familyId, viewer.family.id), farmPlanVisible(viewer)));
  if (!plan) notFound();
  const [members, access] = await Promise.all([memberOptions(viewer), getRecordAccess("farm_plan", [id])]);
  const mayShare = canChangeItem(viewer, plan.createdByMemberId);
  const canEdit = viewer.can("farm", "edit");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/farm" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Farm
      </Link>
      <PageHeader
        eyebrow={<PlanEyebrow label="Farm map" visibility={plan.visibility} shared={(access.get(plan.id) ?? []).length} />}
        title={plan.name}
        description={plan.notes ?? undefined}
        actions={
          canEdit ? (
            <>
              <FormModal title="Map details" action={updateFarmPlan} size="sm" triggerContent={<><Pencil className="size-4" /> Details</>} triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                <input type="hidden" name="id" value={plan.id} />
                <TextField name="name" label="Name" required defaultValue={plan.name} />
                <TextAreaField name="notes" label="Notes" rows={3} defaultValue={plan.notes ?? ""} />
                {mayShare ? <VisibilityField members={members} defaultValue={plan.visibility} defaultSelected={access.get(plan.id) ?? []} /> : <input type="hidden" name="visibility" value={plan.visibility} />}
              </FormModal>
              <ActionButton action={deleteFarmPlan} fields={{ id }} confirm="Delete this farm map?" className="h-9 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
                <Trash2 className="size-4" /> Delete
              </ActionButton>
            </>
          ) : undefined
        }
      />
      <BlueprintEditor kind="farm" initial={plan.layout} canEdit={canEdit} onSave={saveFarmLayout.bind(null, id)} />
    </div>
  );
}
