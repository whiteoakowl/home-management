import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/db";
import { farmPlans } from "@/db/schema";
import { deleteFarmPlan, saveFarmLayout } from "@/app/actions/farm";
import { BlueprintEditor } from "@/components/blueprint/editor";
import { ActionButton } from "@/components/forms/inline";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Farm map" };

export default async function FarmPlanPage({ params }: PageProps<"/farm/plans/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const [plan] = await db.select().from(farmPlans).where(and(eq(farmPlans.id, id), eq(farmPlans.familyId, viewer.family.id)));
  if (!plan) notFound();
  const canEdit = viewer.can("farm", "edit");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/farm" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Farm
      </Link>
      <PageHeader
        eyebrow="Farm map"
        title={plan.name}
        actions={
          canEdit ? (
            <ActionButton action={deleteFarmPlan} fields={{ id }} confirm="Delete this farm map?" className="h-9 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
              <Trash2 className="size-4" /> Delete
            </ActionButton>
          ) : undefined
        }
      />
      <BlueprintEditor kind="farm" initial={plan.layout} canEdit={canEdit} onSave={saveFarmLayout.bind(null, id)} />
    </div>
  );
}
