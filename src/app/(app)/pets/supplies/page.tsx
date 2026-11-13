import type { Metadata } from "next";
import { ShoppingBasket } from "lucide-react";
import { SupplyCard, SupplyModal } from "@/components/pets/pet-parts";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { listPets, petSuppliesFor } from "@/lib/pets";
import { petsViewer } from "../shared";

export const metadata: Metadata = { title: "Pet food & supplies" };

export default async function PetSuppliesPage() {
  const viewer = await petsViewer();
  const [list, supplies] = await Promise.all([listPets(viewer), petSuppliesFor(viewer)]);
  const canEdit = viewer.can("pets", "edit");
  return (
    <>
      <PageHeader
        eyebrow="Pets"
        title="Food & supplies"
        description="Part of the household inventory (Kitchen → Pets). Items at or below their restock level are added to the shopping list automatically."
        actions={canEdit && <SupplyModal pets={list.map((p) => ({ id: p.id, name: p.name }))} />}
      />
      <PetsTabs active="supplies" />
      {supplies.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {supplies.map((x) => (
            <SupplyCard key={x.s.id} x={x} canEdit={canEdit} canShop={viewer.can("shopping", "edit")} showPet />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<ShoppingBasket />} title="No food or supplies yet" description="Track food, treats, supplements, medicine and grooming supplies." />
        </Card>
      )}
    </>
  );
}
