import Link from "next/link";
import { redirect } from "next/navigation";
import { savePet } from "@/app/actions/pets";
import { RecordModal } from "@/components/forms/config-form";
import type { MemberOption } from "@/components/forms/fields";
import { Badge } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { PET_FIELDS, SPECIES, petAge, speciesEmoji } from "@/lib/pets-config";
import type { FieldValue } from "@/lib/record-fields";

export async function petsViewer() {
  const viewer = await getViewer();
  if (!viewer.can("pets")) redirect("/");
  return viewer;
}

type Pet = { id: string; name: string; species: string; breed: string | null; birthday: string | null; imageFileId: string | null; status: string; [k: string]: unknown };

export function PetModal({ members, pet }: { members: MemberOption[]; pet?: Pet }) {
  const defaults: Record<string, FieldValue | undefined> = pet
    ? Object.fromEntries(PET_FIELDS.map((f) => [f.name, f.name === "weight" ? (pet.weight === null ? null : Number(pet.weight)) : (pet[f.name] as FieldValue)]))
    : { status: "active", species: "dog", weightUnit: "lb" };
  return (
    <RecordModal
      title={pet ? `Edit ${pet.name}` : "Add a pet"}
      triggerLabel={pet ? "Edit" : "Add pet"}
      triggerVariant={pet ? "secondary" : "primary"}
      action={savePet}
      fields={PET_FIELDS}
      defaults={defaults}
      hidden={pet ? { id: pet.id } : {}}
      members={members}
      imageUrls={{ image: pet ? fileUrl(pet.imageFileId) : null }}
    />
  );
}

export function PetCard({ pet, today, extra }: { pet: Pet; today: string; extra?: React.ReactNode }) {
  const img = fileUrl(pet.imageFileId);
  const age = petAge(pet.birthday, today);
  return (
    <Link href={`/pets/${pet.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-primary-300">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary-50 to-olive-50">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={pet.name} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-6xl" aria-hidden>
            {speciesEmoji(pet.species)}
          </span>
        )}
        {pet.status !== "active" && <span className="absolute top-3 left-3"><Badge tone="neutral">{pet.status === "passed" ? "In loving memory" : "Rehomed"}</Badge></span>}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="font-display text-xl font-semibold group-hover:text-primary-700">{pet.name}</p>
        <p className="text-sm text-muted">{[SPECIES.find((s) => s.value === pet.species)?.label, pet.breed, age].filter(Boolean).join(" · ")}</p>
        {extra}
      </div>
    </Link>
  );
}
