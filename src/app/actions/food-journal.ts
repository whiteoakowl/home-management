"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { foodJournalEntries, mealPlanEntries, recipes } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { deleteFamilyFile, saveUpload } from "@/lib/files";
import { FOOD_MEALS, slotForMeal } from "@/lib/food-journal";
import { f } from "@/lib/records";
import { managedMember } from "@/lib/personal-health";

const revalidate = () => {
  revalidatePath("/health", "layout");
  revalidatePath("/fitness", "layout");
};
const level = (n: number | null) => (n !== null && n >= 1 && n <= 5 ? n : null);

/** Add or edit a personal food journal entry (yours, or a member without a login when you're a parent). */
export async function saveFoodEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const id = f.str(fd, "id");
    const existing = id ? (await db.select().from(foodJournalEntries).where(and(eq(foodJournalEntries.id, id), eq(foodJournalEntries.familyId, viewer.family.id))))[0] : null;
    if (id && !existing) throw new AuthorizationError("Entry not found.");
    const member = await managedMember(viewer, existing?.memberId ?? fd.get("memberId"));
    const food = f.str(fd, "food");
    if (!food) return fail("What did you have?", "food");
    const mealRaw = f.str(fd, "meal") ?? "other";
    const meal = FOOD_MEALS.some((m) => m.key === mealRaw) ? mealRaw : "other";
    const time = f.str(fd, "time");
    const image = await saveUpload(viewer, fd.get("image"));
    const values = {
      date: f.date(fd, "date") ?? todayIn(viewer.family.timezone),
      time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
      meal,
      slot: slotForMeal(meal),
      food: food.slice(0, 300),
      portion: f.str(fd, "portion")?.slice(0, 120) ?? null,
      hunger: level(f.int(fd, "hunger")),
      fullness: level(f.int(fd, "fullness")),
      feelings: fd.getAll("feelings").map(String).filter(Boolean).slice(0, 12),
      notes: f.str(fd, "notes")?.slice(0, 2000) ?? null,
      ...(image ? { imageFileId: image } : {}),
    };
    if (existing) {
      await db.update(foodJournalEntries).set(f.bool(fd, "removeImage") && !image ? { ...values, imageFileId: null } : values).where(eq(foodJournalEntries.id, existing.id));
      if ((image || f.bool(fd, "removeImage")) && existing.imageFileId) await deleteFamilyFile(viewer.family.id, existing.imageFileId);
    } else {
      await db.insert(foodJournalEntries).values({ familyId: viewer.family.id, memberId: member.id, ...values });
    }
    revalidate();
    return ok(existing ? "Saved." : "Added to your food journal.");
  });
}

/** Meal plan → food journal in one tap. */
export async function logPlannedMeal(fd: FormData) {
  const viewer = await getViewer();
  const member = await managedMember(viewer, fd.get("memberId"));
  const [e] = await db
    .select({ e: mealPlanEntries, name: recipes.name })
    .from(mealPlanEntries)
    .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(and(eq(mealPlanEntries.id, String(fd.get("id"))), eq(mealPlanEntries.familyId, viewer.family.id)));
  if (!e || (e.e.ownerMemberId && e.e.ownerMemberId !== viewer.member.id)) return;
  await db.insert(foodJournalEntries).values({ familyId: viewer.family.id, memberId: member.id, date: e.e.date, slot: e.e.slot, meal: e.e.slot, food: e.name ?? e.e.title ?? "Meal", mealPlanEntryId: e.e.id });
  revalidate();
}

export async function deleteFoodEntry(fd: FormData) {
  const viewer = await getViewer();
  const [e] = await db.select().from(foodJournalEntries).where(and(eq(foodJournalEntries.id, String(fd.get("id"))), eq(foodJournalEntries.familyId, viewer.family.id)));
  if (!e) return;
  await managedMember(viewer, e.memberId);
  await db.delete(foodJournalEntries).where(eq(foodJournalEntries.id, e.id));
  await deleteFamilyFile(viewer.family.id, e.imageFileId);
  revalidate();
}
