import type { Metadata } from "next";
import { PawPrint } from "lucide-react";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { listOccurrences } from "@/lib/chores";
import { addDays, todayIn } from "@/lib/dates";
import { listPets } from "@/lib/pets";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { petsViewer } from "../shared";

export const metadata: Metadata = { title: "Pet care schedule" };

export default async function PetCarePage() {
  const viewer = await petsViewer();
  const today = todayIn(viewer.family.timezone);
  const [members, list, rooms, cats] = await Promise.all([memberOptions(viewer), listPets(viewer), roomOptions(viewer), categoryOptions(viewer, "chore")]);
  const canChores = viewer.can("chores", "edit");
  const occ = viewer.can("chores") ? await listOccurrences(viewer, { kinds: ["chore", "task"], petIds: list.map((p) => p.id), from: addDays(today, -1), to: addDays(today, 7), statuses: ["pending"] }) : [];
  return (
    <>
      <PageHeader eyebrow="Pets" title="Care schedule" description="Feeding, walking, grooming, litter and other pet chores. They're regular chores too, so they show on everyone's chore list and the family calendar." />
      <PetsTabs active="care" />
      <Card className="mb-6">
        <CardHeader title="Next 7 days" icon={<PawPrint className="size-4" />} />
        {occ.length ? <OccurrenceList items={occ} today={today} members={members} canManage={canChores} /> : <EmptyState icon={<PawPrint />} title="No pet chores scheduled" description="Add one for a pet below." compact />}
      </Card>
      {canChores && list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {list.map((p) => (
            <ChoreFormModal key={p.id} kind="chore" members={members} rooms={rooms} categories={cats} links={{ petId: p.id }} label={`Chore for ${p.name}`} />
          ))}
        </div>
      )}
    </>
  );
}
