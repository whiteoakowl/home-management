import type { Metadata } from "next";
import { desc, inArray } from "drizzle-orm";
import { HeartPulse } from "lucide-react";
import { db } from "@/db";
import { petMedicalRecords } from "@/db/schema";
import { PetRecordModal, PetRecordRow } from "@/components/pets/pet-parts";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { listPets } from "@/lib/pets";
import { PET_RECORD_KINDS } from "@/lib/pets-config";
import { petsViewer } from "../shared";

export const metadata: Metadata = { title: "Pet medical records" };

export default async function PetHealthPage({ searchParams }: PageProps<"/pets/health">) {
  const viewer = await petsViewer();
  const sp = (await searchParams) as { pet?: string; kind?: string };
  const list = await listPets(viewer, { includePast: true });
  const ids = list.map((p) => p.id);
  const rows = ids.length ? await db.select().from(petMedicalRecords).where(inArray(petMedicalRecords.petId, sp.pet && ids.includes(sp.pet) ? [sp.pet] : ids)).orderBy(desc(petMedicalRecords.date)) : [];
  const shown = sp.kind ? rows.filter((r) => r.kind === sp.kind) : rows;
  const canEdit = viewer.can("pets", "edit");
  const name = (id: string) => list.find((p) => p.id === id)?.name;
  const selected = sp.pet && list.find((p) => p.id === sp.pet);
  return (
    <>
      <PageHeader eyebrow="Pets" title="Medical records" description="Vet visits, vaccinations, conditions, injuries, surgeries, dental care and test results." actions={canEdit && selected && <PetRecordModal petId={selected.id} canBudget={viewer.can("budget", "edit")} />} />
      <PetsTabs active="health" />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="pet" defaultValue={sp.pet ?? ""} aria-label="Pet" className="h-10 rounded-full border border-line-strong bg-surface px-3 text-sm">
          <option value="">All pets</option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="kind" defaultValue={sp.kind ?? ""} aria-label="Type" className="h-10 rounded-full border border-line-strong bg-surface px-3 text-sm">
          <option value="">All types</option>
          {PET_RECORD_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white">Filter</button>
      </form>
      {!selected && canEdit && list.length > 0 && <p className="mb-3 text-sm text-muted">Choose a pet above to add a record, or add one from the pet&apos;s profile.</p>}
      <Card>
        {shown.length ? (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <PetRecordRow key={r.id} r={r} canEdit={canEdit} petName={sp.pet ? undefined : name(r.petId)} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<HeartPulse />} title="No records" description="Records you add on a pet's profile appear here." compact />
        )}
      </Card>
    </>
  );
}
