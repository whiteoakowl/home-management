import type { Metadata } from "next";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { PageHeader } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { listPets } from "@/lib/pets";
import { memberOptions } from "@/lib/queries";
import { PetCard, PetModal, petsViewer } from "../shared";

export const metadata: Metadata = { title: "Pet profiles" };

export default async function PetProfilesPage() {
  const viewer = await petsViewer();
  const today = todayIn(viewer.family.timezone);
  const [members, list] = await Promise.all([memberOptions(viewer), listPets(viewer, { includePast: true })]);
  const active = list.filter((p) => p.status === "active");
  const past = list.filter((p) => p.status !== "active");
  return (
    <>
      <PageHeader eyebrow="Pets" title="Pet profiles" actions={viewer.can("pets", "edit") && <PetModal members={members} />} />
      <PetsTabs active="profiles" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {active.map((p) => (
          <PetCard key={p.id} pet={p} today={today} />
        ))}
      </div>
      {active.length === 0 && <p className="text-sm text-muted">No pets yet.</p>}
      {past.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold">In loving memory &amp; rehomed</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {past.map((p) => (
              <PetCard key={p.id} pet={p} today={today} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
