import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chores, inventoryItems, journalEntries, journalEntryFiles, petCareNotes, petMedicalRecords, petPhotos, petPreventatives, petSupplies, pets } from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";

export async function listPets(viewer: Viewer, opts: { includePast?: boolean } = {}) {
  return db
    .select()
    .from(pets)
    .where(and(eq(pets.familyId, viewer.family.id), opts.includePast ? undefined : eq(pets.status, "active")))
    .orderBy(asc(pets.name));
}

export async function getPet(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db.select().from(pets).where(and(eq(pets.id, id), eq(pets.familyId, viewer.family.id)));
  return p ?? null;
}

const PET_CHILD = { medical: petMedicalRecords, preventative: petPreventatives, care: petCareNotes, photo: petPhotos } as const;
type PetChild = keyof typeof PET_CHILD;

/** A record hanging off a pet, ownership-checked through pets.family_id. */
export async function petRecordOwned<K extends PetChild>(viewer: Viewer, table: K, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const t = PET_CHILD[table] as unknown as typeof petCareNotes;
  const [r] = await db
    .select({ r: t, pet: pets })
    .from(t)
    .innerJoin(pets, eq(pets.id, t.petId))
    .where(and(eq(t.id, id), eq(pets.familyId, viewer.family.id)));
  return (r ?? null) as { r: (typeof PET_CHILD)[K]["$inferSelect"]; pet: typeof pets.$inferSelect } | null;
}

export async function petSupplyOwned(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db
    .select({ s: petSupplies, item: inventoryItems })
    .from(petSupplies)
    .innerJoin(inventoryItems, eq(inventoryItems.id, petSupplies.inventoryItemId))
    .where(and(eq(petSupplies.id, id), eq(inventoryItems.familyId, viewer.family.id)));
  return r ?? null;
}

export async function petSuppliesFor(viewer: Viewer, petId?: string) {
  return db
    .select({ s: petSupplies, item: inventoryItems, petName: pets.name })
    .from(petSupplies)
    .innerJoin(inventoryItems, eq(inventoryItems.id, petSupplies.inventoryItemId))
    .leftJoin(pets, eq(pets.id, petSupplies.petId))
    .where(and(eq(inventoryItems.familyId, viewer.family.id), isNull(inventoryItems.archivedAt), petId ? eq(petSupplies.petId, petId) : undefined))
    .orderBy(asc(inventoryItems.name));
}

export async function preventativesFor(viewer: Viewer, petIds: string[]) {
  if (!petIds.length) return [];
  return db.select().from(petPreventatives).where(inArray(petPreventatives.petId, petIds)).orderBy(asc(petPreventatives.nextDueOn));
}

export async function petChores(viewer: Viewer, petIds: string[]) {
  if (!petIds.length) return [];
  return db
    .select()
    .from(chores)
    .where(and(eq(chores.familyId, viewer.family.id), inArray(chores.petId, petIds), isNull(chores.archivedAt)))
    .orderBy(asc(chores.title));
}

/** Pet memories are journal entries (book 'pet', linkedId = pet id), visibility-checked. */
export async function petMemories(viewer: Viewer, petId?: string) {
  const rows = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.familyId, viewer.family.id),
        eq(journalEntries.book, "pet"),
        petId ? eq(journalEntries.linkedId, petId) : undefined,
        visibleTo(viewer, { id: journalEntries.id, visibility: journalEntries.visibility, author: journalEntries.authorMemberId }, "journal_entry", { parentsSeePrivate: false }),
      ),
    )
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt));
  const files = rows.length
    ? await db.select().from(journalEntryFiles).where(inArray(journalEntryFiles.entryId, rows.map((r) => r.id))).orderBy(asc(journalEntryFiles.position))
    : [];
  const byEntry = Map.groupBy(files, (f) => f.entryId);
  return rows.map((r) => ({ ...r, photos: (byEntry.get(r.id) ?? []).map((f) => f.fileId) }));
}
