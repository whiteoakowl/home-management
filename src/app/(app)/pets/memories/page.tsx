import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { MemoryItem, MemoryModal } from "@/components/pets/pet-parts";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { listPets, petMemories } from "@/lib/pets";
import { memberOptions } from "@/lib/queries";
import { petsViewer } from "../shared";

export const metadata: Metadata = { title: "Pet memories" };

export default async function PetMemoriesPage() {
  const viewer = await petsViewer();
  const today = todayIn(viewer.family.timezone);
  const [members, list, memories] = await Promise.all([memberOptions(viewer), listPets(viewer, { includePast: true }), petMemories(viewer)]);
  const canEdit = viewer.can("pets", "edit");
  const name = (id: string | null) => list.find((p) => p.id === id)?.name;
  return (
    <>
      <PageHeader eyebrow="Pets" title="Memories" description="A timeline of adoption days, birthdays, achievements and favorite moments." />
      <PetsTabs active="memories" />
      {canEdit && list.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {list.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 text-sm text-muted">
              {p.name}: <MemoryModal petId={p.id} members={members} today={today} />
            </span>
          ))}
        </div>
      )}
      <Card>
        {memories.length ? (
          <ol className="flex flex-col gap-5 border-l border-line pl-1">
            {memories.map((m) => (
              <MemoryItem key={m.id} m={m} petName={name(m.linkedId)} canDelete={canEdit && m.authorMemberId === viewer.member.id} />
            ))}
          </ol>
        ) : (
          <EmptyState icon={<NotebookPen />} title="No memories yet" description="Capture the moments you never want to forget." compact />
        )}
      </Card>
    </>
  );
}
