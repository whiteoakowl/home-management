import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, HeartPulse, NotebookPen, PawPrint, ShieldCheck, ShoppingBasket, Sparkles, X } from "lucide-react";
import { addPetPhotos, deletePet, deletePetPhoto } from "@/app/actions/pets";
import { FormModal } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { CareNoteCard, CareNoteModal, MemoryItem, MemoryModal, PetRecordModal, PetRecordRow, PreventativeModal, PreventativeRow, SupplyCard, SupplyModal } from "@/components/pets/pet-parts";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { DetailList } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui/display";
import { db } from "@/db";
import { petCareNotes, petMedicalRecords, petPhotos } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { listOccurrences } from "@/lib/chores";
import { addDays, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { getPet, petChores, petMemories, petSuppliesFor, preventativesFor } from "@/lib/pets";
import { PET_FIELDS, SPECIES, petAge, speciesEmoji } from "@/lib/pets-config";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { PetModal, petsViewer } from "../shared";

export const metadata: Metadata = { title: "Pet" };

export default async function PetPage({ params }: PageProps<"/pets/[id]">) {
  const { id } = await params;
  const viewer = await petsViewer();
  const pet = await getPet(viewer, id);
  if (!pet) notFound();
  const today = todayIn(viewer.family.timezone);
  const canEdit = viewer.can("pets", "edit");
  const canChores = viewer.can("chores", "edit");
  const [members, records, prevs, supplies, notes, photos, memories, choreRows, occ, rooms, cats] = await Promise.all([
    memberOptions(viewer),
    db.select().from(petMedicalRecords).where(eq(petMedicalRecords.petId, pet.id)).orderBy(desc(petMedicalRecords.date)),
    preventativesFor(viewer, [pet.id]),
    petSuppliesFor(viewer, pet.id),
    db.select().from(petCareNotes).where(eq(petCareNotes.petId, pet.id)).orderBy(asc(petCareNotes.kind)),
    db.select().from(petPhotos).where(eq(petPhotos.petId, pet.id)).orderBy(desc(petPhotos.createdAt)),
    petMemories(viewer, pet.id),
    petChores(viewer, [pet.id]),
    viewer.can("chores") ? listOccurrences(viewer, { kinds: ["chore", "task"], petIds: [pet.id], from: addDays(today, -1), to: addDays(today, 7), statuses: ["pending"] }) : Promise.resolve([]),
    roomOptions(viewer),
    categoryOptions(viewer, "chore"),
  ]);
  const img = fileUrl(pet.imageFileId);
  const caretaker = members.find((m) => m.id === pet.caretakerMemberId);
  const age = petAge(pet.birthday, today);
  // One upcoming occurrence per chore keeps daily chores from flooding the card.
  const nextOcc = [...Map.groupBy(occ, (o) => o.choreId).values()].map((g) => g[0]!);
  const emergency = notes.filter((n) => n.kind === "emergency");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/pets" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Pets
      </Link>
      <PetsTabs active="profiles" />

      <section className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-primary-50 to-olive-50">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={pet.name} className="aspect-square w-full object-cover" />
          ) : (
            <span className="flex aspect-square items-center justify-center text-8xl" aria-hidden>
              {speciesEmoji(pet.species)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{SPECIES.find((s) => s.value === pet.species)?.label}</Badge>
            {pet.breed && <Badge>{pet.breed}</Badge>}
            {age && <Badge tone="olive">{age}</Badge>}
            {pet.status !== "active" && <Badge tone="neutral">{pet.status === "passed" ? "In loving memory" : "Rehomed"}</Badge>}
          </div>
          <h1 className="text-[34px] leading-tight font-semibold">{pet.name}</h1>
          {caretaker && (
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <Avatar name={caretaker.displayName} color={caretaker.color} size="xs" /> Primary caretaker: {caretaker.displayName}
            </p>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <PetModal members={members} pet={pet} />
              <DeleteButton action={deletePet} fields={{ id: pet.id }} what={pet.name} />
            </div>
          )}
          <DetailList fields={PET_FIELDS} values={{ ...pet, caretakerMemberId: null }} skip={["name", "species", "breed", "status"]} className="mt-2" />
        </div>
      </section>

      {emergency.length > 0 && (
        <section className="rounded-2xl border border-wine-200 bg-wine-50 p-4" aria-label="Emergency instructions">
          <p className="font-semibold text-wine-700">Emergency instructions</p>
          {emergency.map((n) => (
            <p key={n.id} className="mt-1 text-sm whitespace-pre-line">
              {n.body}
            </p>
          ))}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Preventatives" icon={<ShieldCheck className="size-4" />} action={canEdit && <PreventativeModal petId={pet.id} members={members} />} />
          {prevs.length ? (
            <ul className="divide-y divide-line">
              {prevs.map((p) => (
                <PreventativeRow key={p.id} p={p} today={today} members={members} canEdit={canEdit} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Track flea, tick, heartworm, deworming and vaccines with reminders.</p>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Care schedule"
            icon={<PawPrint className="size-4" />}
            action={canChores && <ChoreFormModal kind="chore" members={members} rooms={rooms} categories={cats} links={{ petId: pet.id }} label="Care chore" />}
          />
          {nextOcc.length > 0 && <OccurrenceList items={nextOcc} today={today} members={members} canManage={canChores} />}
          {choreRows.length ? (
            <p className="mt-3 text-sm text-muted">
              Recurring: {choreRows.map((c) => c.title).join(", ")}.{" "}
              <Link href="/house/chores" className="font-medium text-primary-700 underline">
                Manage in Chores
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted">Add feeding, walking, grooming or litter chores. They appear on chore lists and the family calendar.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Medical records" icon={<HeartPulse className="size-4" />} action={canEdit && <PetRecordModal petId={pet.id} canBudget={viewer.can("budget", "edit")} />} />
        {records.length ? (
          <ul className="divide-y divide-line">
            {records.map((r) => (
              <PetRecordRow key={r.id} r={r} canEdit={canEdit} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Vet visits, vaccinations, conditions, allergies, injuries, surgeries, dental care and test results.</p>
        )}
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingBasket className="size-5 text-primary-600" aria-hidden /> Food &amp; supplies
          </h2>
          {canEdit && <SupplyModal petId={pet.id} />}
        </div>
        {supplies.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {supplies.map((x) => (
              <SupplyCard key={x.s.id} x={x} canEdit={canEdit} canShop={viewer.can("shopping", "edit")} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Food, treats, supplements and supplies. Low stock goes onto the shopping list automatically.</p>
        )}
      </section>

      <Card>
        <CardHeader title="Special care" icon={<Sparkles className="size-4" />} action={canEdit && <CareNoteModal petId={pet.id} />} />
        {notes.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {notes.map((n) => (
              <CareNoteCard key={n.id} n={n} petId={pet.id} canEdit={canEdit} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Feeding and medication schedules, grooming, behavior, mobility and caregiver instructions.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Photo gallery"
          icon={<Camera className="size-4" />}
          action={
            canEdit && (
              <FormModal title="Add photos" action={addPetPhotos} triggerLabel="Photos" triggerVariant="soft" size="md" submitLabel="Upload">
                <input type="hidden" name="petId" value={pet.id} />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
                  Photos (up to 12)
                  <input type="file" name="photos" accept="image/*" multiple required className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
                </label>
                <TextField name="caption" label="Caption" />
              </FormModal>
            )
          }
        />
        {photos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((ph) => (
              <li key={ph.id} className="group relative">
                <a href={fileUrl(ph.fileId)!} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(ph.fileId, true)!} alt={ph.caption ?? pet.name} className="aspect-square w-full rounded-xl object-cover" />
                </a>
                {ph.caption && <p className="mt-1 truncate text-xs text-muted">{ph.caption}</p>}
                {canEdit && (
                  <ActionButton action={deletePetPhoto} fields={{ id: ph.id }} confirm="Delete this photo?" label="Delete photo" className="absolute top-2 right-2 size-8 rounded-full bg-surface/90 text-muted shadow hover:text-wine-500">
                    <X className="size-4" />
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No photos yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Memories" icon={<NotebookPen className="size-4" />} action={canEdit && <MemoryModal petId={pet.id} members={members} today={today} />} />
        {memories.length ? (
          <ol className="flex flex-col gap-5 border-l border-line pl-1">
            {memories.map((m) => (
              <MemoryItem key={m.id} m={m} canDelete={canEdit && m.authorMemberId === viewer.member.id} />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">Adoption day, birthdays, funny moments and milestones. Memories are also part of the family journal.</p>
        )}
      </Card>
    </div>
  );
}
