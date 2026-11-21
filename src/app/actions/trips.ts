"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { photoAlbums, planExpenses, planItems, plans } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { AuthorizationError, canChangeItem, requireModule, type Viewer } from "@/lib/dal";
import { listGoals } from "@/lib/goals";
import { familyMemberIds, f, saveRecordAccess, visibilityFromForm } from "@/lib/records";
import { getPlan } from "@/lib/trips";
import { saveUpload } from "@/lib/files";

/**
 * Plans (vacations, trips, events). Anyone with Plans "Use" makes their own and
 * chooses who sees each one; only its planner (or a parent) changes it.
 */
function revalidatePlans(id?: string) {
  revalidatePath("/plans", "layout");
  if (id) revalidatePath(`/plans/${id}`);
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
}

const KINDS = ["vacation", "trip", "event", "other"] as const;
const ITEM_KINDS = ["itinerary", "flight", "hotel", "vehicle", "reservation", "note"] as const;

async function changeablePlan(viewer: Viewer, id: string) {
  const plan = await getPlan(viewer, id);
  if (!plan) throw new AuthorizationError("Plan not found.");
  if (!canChangeItem(viewer, plan.p.createdByMemberId)) throw new AuthorizationError("Only the person who made this plan (or a parent) can change it.");
  return plan.p;
}

/** Only http(s) links; "airline.com/..." gets https:// added. */
function safeLink(v: string | null) {
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

const time = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "");
  return /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
};

export async function savePlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("plans", "use");
    const id = f.str(fd, "id");
    const old = id ? await changeablePlan(viewer, id) : null;
    const title = f.str(fd, "title");
    if (!title) return fail("Name your plan (e.g. Disney World 2027).", "title");
    const startDate = f.date(fd, "startDate");
    let endDate = f.date(fd, "endDate");
    if (startDate && endDate && endDate < startDate) endDate = startDate;
    // Only a savings goal the planner can see may be linked.
    const goalId = f.str(fd, "savingsGoalId");
    const goalOk = goalId ? (await listGoals(viewer, { kind: "savings" })).some((g) => g.g.id === goalId) : true;
    if (!goalOk) return fail("Pick one of your savings goals.", "savingsGoalId");
    const image = await saveUpload(viewer, fd.get("image"));
    const { visibility, memberIds } = visibilityFromForm(fd);
    const values = {
      title: title.slice(0, 120),
      kind: KINDS.find((k) => k === fd.get("kind")) ?? "vacation",
      destination: f.str(fd, "destination"),
      description: f.str(fd, "description"),
      startDate,
      endDate,
      memberIds: await familyMemberIds(viewer.family.id, f.list(fd, "memberIds")),
      savingsGoalId: goalId,
      budgetCents: f.cents(fd, "budget"),
      visibility,
      ...(image ? { imageFileId: image } : {}),
    };
    let planId = id;
    await db.transaction(async (tx) => {
      if (old) await tx.update(plans).set(values).where(eq(plans.id, old.id));
      else {
        const [row] = await tx.insert(plans).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id }).returning({ id: plans.id });
        planId = row!.id;
      }
      await saveRecordAccess(tx, viewer.family.id, "plan", planId!, memberIds);
    });
    revalidatePlans(planId!);
    if (!id) redirect(`/plans/${planId}`);
    return ok("Saved.");
  });
}

export async function deletePlan(fd: FormData) {
  const viewer = await requireModule("plans", "use");
  const p = await changeablePlan(viewer, String(fd.get("id")));
  await db.delete(plans).where(eq(plans.id, p.id));
  revalidatePlans();
  redirect("/plans");
}

export async function savePlanItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("plans", "use");
    const p = await changeablePlan(viewer, String(fd.get("planId")));
    const kind = ITEM_KINDS.find((k) => k === fd.get("kind")) ?? "itinerary";
    const provider = f.str(fd, "provider");
    const fromPlace = f.str(fd, "fromPlace");
    const toPlace = f.str(fd, "toPlace");
    const title =
      f.str(fd, "title") ??
      (kind === "flight" && (fromPlace || toPlace) ? `${fromPlace ?? "?"} → ${toPlace ?? "?"}` : kind === "hotel" || kind === "vehicle" ? provider : null);
    if (!title) return fail(kind === "flight" ? "Add the airports or a name." : "Give it a name.", "title");
    const values = {
      planId: p.id,
      kind,
      title: title.slice(0, 120),
      date: f.date(fd, "date"),
      startTime: time(fd, "startTime"),
      endDate: f.date(fd, "endDate"),
      endTime: time(fd, "endTime"),
      location: f.str(fd, "location"),
      fromPlace,
      toPlace,
      provider,
      confirmation: f.str(fd, "confirmation"),
      phone: f.str(fd, "phone"),
      link: safeLink(f.str(fd, "link")),
      costCents: f.cents(fd, "cost"),
      notes: f.str(fd, "notes"),
    };
    const id = f.str(fd, "id");
    if (id) {
      const [old] = await db.select({ id: planItems.id }).from(planItems).where(and(eq(planItems.id, id), eq(planItems.planId, p.id)));
      if (!old) throw new AuthorizationError("Not found.");
      await db.update(planItems).set(values).where(eq(planItems.id, old.id));
    } else await db.insert(planItems).values(values);
    revalidatePlans(p.id);
    return ok("Saved.");
  });
}

export async function deletePlanItem(fd: FormData) {
  const viewer = await requireModule("plans", "use");
  const [item] = await db.select().from(planItems).where(eq(planItems.id, String(fd.get("id"))));
  if (!item) return;
  const p = await changeablePlan(viewer, item.planId);
  await db.delete(planItems).where(eq(planItems.id, item.id));
  revalidatePlans(p.id);
}

// ─── Trip expenses & photos ──────────────────────────────────────────────────

const EXPENSE_CATEGORIES = ["lodging", "food", "tickets", "travel", "shopping", "other"] as const;

export async function savePlanExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("plans", "use");
    const plan = await changeablePlan(viewer, f.str(fd, "planId") ?? "");
    const title = f.str(fd, "title");
    if (!title) return fail("What was it for?", "title");
    const amount = f.cents(fd, "amount");
    if (amount === null || amount < 0 || amount > 100_000_000) return fail("Enter the amount.", "amount");
    const cat = f.str(fd, "category");
    const payer = f.str(fd, "paidBy");
    const values = {
      title: title.slice(0, 120),
      amountCents: amount,
      date: f.date(fd, "date"),
      category: EXPENSE_CATEGORIES.find((c) => c === cat) ?? "other",
      paidByMemberId: payer ? ((await familyMemberIds(viewer.family.id, [payer]))[0] ?? null) : null,
      notes: f.str(fd, "notes")?.slice(0, 500) ?? null,
    };
    const id = f.str(fd, "id");
    if (id) await db.update(planExpenses).set(values).where(and(eq(planExpenses.id, id), eq(planExpenses.planId, plan.id)));
    else await db.insert(planExpenses).values({ ...values, planId: plan.id, familyId: viewer.family.id });
    revalidatePlans(plan.id);
    return ok("Saved.");
  });
}

export async function deletePlanExpense(fd: FormData) {
  const viewer = await requireModule("plans", "use");
  const id = f.str(fd, "id") ?? "";
  const [x] = await db.select().from(planExpenses).where(and(eq(planExpenses.id, id), eq(planExpenses.familyId, viewer.family.id)));
  if (!x) return;
  await changeablePlan(viewer, x.planId);
  await db.delete(planExpenses).where(eq(planExpenses.id, x.id));
  revalidatePlans(x.planId);
}

/** Make (or open) the trip's photo album. */
export async function openTripAlbum(fd: FormData) {
  const viewer = await requireModule("plans", "view");
  const plan = await getPlan(viewer, f.str(fd, "planId") ?? "");
  if (!plan) throw new AuthorizationError("Plan not found.");
  const [existing] = await db.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.familyId, viewer.family.id), eq(photoAlbums.planId, plan.p.id)));
  if (existing) redirect(`/photos/${existing.id}`);
  if (!viewer.can("photos", "use")) throw new AuthorizationError("You can't make photo albums.");
  const [a] = await db
    .insert(photoAlbums)
    .values({ familyId: viewer.family.id, title: plan.p.title, eventDate: plan.p.startDate, planId: plan.p.id, private: plan.p.visibility === "private", createdByMemberId: viewer.member.id, description: plan.p.destination })
    .returning({ id: photoAlbums.id });
  revalidatePlans(plan.p.id);
  redirect(`/photos/${a!.id}`);
}
