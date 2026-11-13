import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PreventativeModal, PreventativeRow } from "@/components/pets/pet-parts";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { listPets, preventativesFor } from "@/lib/pets";
import { memberOptions } from "@/lib/queries";
import { petsViewer } from "../shared";

export const metadata: Metadata = { title: "Preventatives" };

export default async function PreventativesPage() {
  const viewer = await petsViewer();
  const today = todayIn(viewer.family.timezone);
  const [members, list] = await Promise.all([memberOptions(viewer), listPets(viewer)]);
  const prevs = await preventativesFor(viewer, list.map((p) => p.id));
  const canEdit = viewer.can("pets", "edit");
  return (
    <>
      <PageHeader eyebrow="Pets" title="Preventatives" description="Flea, tick, heartworm, deworming and vaccinations. Mark doses given and the next due date moves forward; reminders go to whoever gives it." />
      <PetsTabs active="preventatives" />
      {list.length === 0 && (
        <Card>
          <EmptyState icon={<ShieldCheck />} title="No pets yet" description="Add a pet first." compact />
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {list.map((p) => {
          const mine = prevs.filter((x) => x.petId === p.id);
          return (
            <Card key={p.id}>
              <CardHeader title={p.name} icon={<ShieldCheck className="size-4" />} action={canEdit && <PreventativeModal petId={p.id} members={members} />} />
              {mine.length ? (
                <ul className="divide-y divide-line">
                  {mine.map((x) => (
                    <PreventativeRow key={x.id} p={x} today={today} members={members} canEdit={canEdit} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No preventatives tracked.</p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
