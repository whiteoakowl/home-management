"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { choreChecklistItems, choreOccurrenceItems, choreOccurrences, chores, pets } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { materializeChore, rematerializeChore } from "@/lib/automation";
import { rebalanceRotations } from "@/lib/rotation-db";
import { kindModule, type ChoreKind } from "@/lib/chores";
import { AuthorizationError, getViewer, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { ownedCategoryId, ownedId, ownedRoomId, ownedStageId, familyProjectId } from "@/lib/queries";
import { f, familyMemberIdOrNull, familyMemberIds, upsertRule } from "@/lib/records";
import { CADENCE_PRESETS, ruleFromForm, type Rule } from "@/lib/recurrence";

const KINDS: ChoreKind[] = ["chore", "cleaning", "maintenance", "task", "farm"];
const CADENCES = ["daily", "weekly", "monthly", "seasonal", "biannual", "annual", "custom"] as const;
type Cadence = (typeof CADENCES)[number];

function revalidateHouse() {
  revalidatePath("/farm", "layout");
  revalidatePath("/house", "layout");
  revalidatePath("/");
  revalidatePath("/calendar");
}

/** The chore's current points, captured at completion so later edits don't rewrite history. */
const pointsOf = (choreId: string) => sql<number | null>`(select nullif(${chores.points}, 0) from ${chores} where ${chores.id} = ${choreId})`;

/**
 * "Add & edit" manages every chore. "Use" may add their own (assigned to
 * themselves, no points) and change or delete only the ones they added.
 */
function requireChoreChange(viewer: Viewer, kind: ChoreKind, createdBy?: string | null) {
  if (viewer.can(kindModule(kind), "edit")) return;
  if (!viewer.can(kindModule(kind), "use")) throw new AuthorizationError("You don't have permission to add these.");
  if (createdBy !== undefined && createdBy !== viewer.member.id) throw new AuthorizationError("Only the person who added this (or a parent) can change it.");
}

/** Create or update a chore / cleaning / maintenance / task template. */
export async function saveChore(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const id = f.str(fd, "id");
    const kind = (f.str(fd, "kind") ?? "chore") as ChoreKind;
    if (!KINDS.includes(kind)) return fail("Unknown type.");
    requireChoreChange(viewer, kind);
    const manager = viewer.can(kindModule(kind), "edit");

    const title = f.str(fd, "title");
    if (!title) return fail("Please give it a name.", "title");
    if (title.length > 120) return fail("Keep the name under 120 characters.", "title");

    const today = todayIn(viewer.family.timezone);
    const startsOn = f.date(fd, "dueDate") ?? today;
    const cadence = (f.str(fd, "cadence") ?? null) as Cadence | null;

    // Schedule: cleaning cadence presets, or the generic recurrence picker.
    let rule: Rule | null;
    if (cadence && cadence !== "custom" && CADENCES.includes(cadence)) {
      rule = { ...CADENCE_PRESETS[cadence], startsOn } as Rule;
      if (cadence === "weekly") rule.byWeekday = [new Date(`${startsOn}T12:00:00Z`).getUTCDay()];
    } else {
      rule = ruleFromForm(fd, startsOn);
    }
    if (!rule && kind !== "task" && !f.date(fd, "dueDate")) {
      return fail("Choose a schedule or a due date.", "dueDate");
    }

    const values = {
      familyId: viewer.family.id,
      kind,
      title,
      description: f.str(fd, "description"),
      instructions: f.str(fd, "instructions"),
      roomId: await ownedRoomId(viewer, f.str(fd, "roomId")),
      categoryId: await ownedCategoryId(viewer, kind === "chore" || kind === "task" ? "chore" : "household", f.str(fd, "categoryId")),
      cleaningCadence: kind === "cleaning" ? (cadence ?? "custom") : null,
      priority: (["low", "normal", "high"].includes(f.str(fd, "priority") ?? "") ? f.str(fd, "priority") : "normal") as "low" | "normal" | "high",
      estimatedMinutes: f.int(fd, "estimatedMinutes"),
      // Members with Use add their own: assigned to themselves, no points.
      defaultAssigneeId: manager ? await familyMemberIdOrNull(viewer.family.id, f.str(fd, "assigneeId")) : viewer.member.id,
      dueDate: rule ? null : f.date(fd, "dueDate"),
      notes: f.str(fd, "notes"),
      points: manager ? Math.max(0, Math.min(1000, f.int(fd, "points") ?? 0)) || null : null,
      rotationMemberIds: manager ? await familyMemberIds(viewer.family.id, f.list(fd, "rotation")) : [],
      ...(fd.has("estimatedCost") ? { estimatedCostCents: f.cents(fd, "estimatedCost") } : {}),
      // Cross-module links are only touched when the form carries them.
      ...(fd.has("petId") ? { petId: await ownedId(viewer, pets, f.str(fd, "petId")) } : {}),
      ...(fd.has("projectId") ? { projectId: await familyProjectId(viewer, f.str(fd, "projectId")) } : {}),
      ...(fd.has("projectStageId") ? { projectStageId: await ownedStageId(viewer, f.str(fd, "projectStageId")) } : {}),
    };

    // Checklist rows come as parallel arrays: item[] + itemAssignee[]
    const texts = fd.getAll("item").map((v) => String(v).trim());
    const assignees = fd.getAll("itemAssignee").map((v) => String(v));
    const checklist: { text: string; assigneeId: string | null }[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (!texts[i]) continue;
      checklist.push({ text: texts[i]!.slice(0, 200), assigneeId: manager ? await familyMemberIdOrNull(viewer.family.id, assignees[i] || null) : null });
    }

    let choreId = id;
    await db.transaction(async (tx) => {
      if (id) {
        const [existing] = await tx.select().from(chores).where(and(eq(chores.id, id), eq(chores.familyId, viewer.family.id)));
        if (!existing) throw new AuthorizationError("Not found.");
        requireChoreChange(viewer, existing.kind, existing.createdByMemberId);
        // Changing the type (e.g. chore → cleaning) needs rights over both areas.
        if (existing.kind !== kind) requireChoreChange(viewer, existing.kind, existing.createdByMemberId);
        const ruleId = await upsertRule(tx, viewer.family.id, rule, existing.recurrenceRuleId);
        await tx.update(chores).set({ ...values, recurrenceRuleId: ruleId }).where(eq(chores.id, id));
        await tx.delete(choreChecklistItems).where(eq(choreChecklistItems.choreId, id));
      } else {
        const ruleId = await upsertRule(tx, viewer.family.id, rule);
        const [row] = await tx
          .insert(chores)
          .values({ ...values, recurrenceRuleId: ruleId, createdByMemberId: viewer.member.id })
          .returning({ id: chores.id });
        choreId = row!.id;
      }
      if (checklist.length) {
        await tx.insert(choreChecklistItems).values(checklist.map((c, position) => ({ choreId: choreId!, ...c, position })));
      }
    });

    if (id) await rematerializeChore(choreId!, today);
    else await materializeChore(choreId!, today);
    await rebalanceRotations(viewer.family.id, today);
    if (!id) {
      const noun = { chore: "a chore", cleaning: "a cleaning task", maintenance: "a maintenance task", task: "a task", farm: "a farm chore" }[kind];
      await logActivity(db, viewer.family.id, viewer.member.id, "chore.created", `added ${noun}: "${title}"`, { module: kindModule(kind), entityId: choreId! });
    }
    revalidateHouse();
    return ok(id ? "Saved." : "Added.");
  });
}

export async function archiveChore(fd: FormData) {
  const viewer = await getViewer();
  const id = String(fd.get("id"));
  const [c] = await db.select().from(chores).where(and(eq(chores.id, id), eq(chores.familyId, viewer.family.id)));
  if (!c) return;
  requireChoreChange(viewer, c.kind, c.createdByMemberId);
  await db.update(chores).set({ archivedAt: new Date() }).where(eq(chores.id, id));
  // Drop pending occurrences; completed history stays.
  await db.delete(choreOccurrences).where(and(eq(choreOccurrences.choreId, id), eq(choreOccurrences.status, "pending")));
  await rebalanceRotations(viewer.family.id, todayIn(viewer.family.timezone));
  revalidateHouse();
  const back = String(fd.get("redirectTo") ?? "");
  if (back.startsWith("/house")) redirect(back);
}

async function editableChore(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await db.select().from(chores).where(and(eq(chores.id, id), eq(chores.familyId, viewer.family.id)));
  if (!c) return null;
  requireChoreChange(viewer, c.kind, c.createdByMemberId);
  return c;
}

/**
 * Delete a chore. It isn't erased: it moves to the Deleted list with its
 * completion history (and the points earned from it) intact, and can be
 * restored. Upcoming occurrences are removed.
 */
export async function deleteChore(fd: FormData) {
  const viewer = await getViewer();
  const c = await editableChore(viewer, String(fd.get("id")));
  if (!c) return;
  const now = new Date();
  await db.update(chores).set({ archivedAt: c.archivedAt ?? now, deletedAt: now }).where(eq(chores.id, c.id));
  await db.delete(choreOccurrences).where(and(eq(choreOccurrences.choreId, c.id), eq(choreOccurrences.status, "pending")));
  await rebalanceRotations(viewer.family.id, todayIn(viewer.family.timezone));
  await logActivity(db, viewer.family.id, viewer.member.id, "chore.deleted", `deleted "${c.title}"`, { module: kindModule(c.kind), entityId: c.id });
  revalidateHouse();
  const back = String(fd.get("redirectTo") ?? "");
  if (back.startsWith("/house") || back.startsWith("/maintenance")) redirect(back);
}

/** Bring an archived or deleted chore back; its schedule starts again from today. */
export async function restoreChore(fd: FormData) {
  const viewer = await getViewer();
  const c = await editableChore(viewer, String(fd.get("id")));
  if (!c) return;
  await db.update(chores).set({ archivedAt: null, deletedAt: null }).where(eq(chores.id, c.id));
  await materializeChore(c.id, todayIn(viewer.family.timezone));
  await rebalanceRotations(viewer.family.id, todayIn(viewer.family.timezone));
  await logActivity(db, viewer.family.id, viewer.member.id, "chore.restored", `restored "${c.title}"`, { module: kindModule(c.kind), entityId: c.id });
  revalidateHouse();
}

/** Load an occurrence and check the viewer may act on it. */
async function occurrenceForViewer(viewer: Viewer, id: string) {
  const [row] = await db
    .select({ occ: choreOccurrences, kind: chores.kind, title: chores.title })
    .from(choreOccurrences)
    .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
    .where(and(eq(choreOccurrences.id, id), eq(choreOccurrences.familyId, viewer.family.id)));
  if (!row) throw new AuthorizationError("Not found.");
  const mine = row.occ.assigneeId === viewer.member.id;
  const assignedItem =
    !mine &&
    (
      await db
        .select({ id: choreOccurrenceItems.id })
        .from(choreOccurrenceItems)
        .where(and(eq(choreOccurrenceItems.occurrenceId, id), eq(choreOccurrenceItems.assigneeId, viewer.member.id)))
        .limit(1)
    ).length > 0;
  const canEdit = viewer.can(kindModule(row.kind), "edit");
  // Ticking things off (and earning points) needs "Use" access or better.
  if (!viewer.can(kindModule(row.kind), "use")) throw new AuthorizationError("You can view this but not check it off.");
  // Cleaning is shared work: anyone with Use access may finish any cleaning task.
  const shared = !mine && !assignedItem && !canEdit && row.kind === "cleaning";
  if (!mine && !assignedItem && !canEdit && !shared) throw new AuthorizationError("That isn't assigned to you.");
  return { ...row, mine, canEdit, shared };
}

export async function setOccurrenceDone(fd: FormData) {
  const viewer = await getViewer();
  const id = String(fd.get("id"));
  const done = fd.get("done") === "true";
  const { occ, title, kind, shared } = await occurrenceForViewer(viewer, id);
  if (shared && !done && occ.completedByMemberId !== viewer.member.id) throw new AuthorizationError("Only the person who finished it (or a parent) can undo that.");
  await db
    .update(choreOccurrences)
    .set(
      done
        ? { status: "done", completedAt: new Date(), completedByMemberId: viewer.member.id, pointsAwarded: pointsOf(occ.choreId) }
        : { status: "pending", completedAt: null, completedByMemberId: null, pointsAwarded: null },
    )
    .where(eq(choreOccurrences.id, occ.id));
  if (done) {
    await db
      .update(choreOccurrenceItems)
      .set({ completedAt: new Date(), completedByMemberId: viewer.member.id })
      .where(and(eq(choreOccurrenceItems.occurrenceId, occ.id), isNull(choreOccurrenceItems.completedAt)));
    await logActivity(db, viewer.family.id, viewer.member.id, "chore.completed", `completed "${title}"`, { module: kindModule(kind), entityId: occ.choreId });
  }
  revalidateHouse();
}

export async function skipOccurrence(fd: FormData) {
  const viewer = await getViewer();
  const { occ, shared } = await occurrenceForViewer(viewer, String(fd.get("id")));
  if (shared) throw new AuthorizationError("Only the person it's assigned to (or a parent) can skip it.");
  await db.update(choreOccurrences).set({ status: occ.status === "skipped" ? "pending" : "skipped" }).where(eq(choreOccurrences.id, occ.id));
  revalidateHouse();
}

export async function reassignOccurrence(fd: FormData) {
  const viewer = await getViewer();
  const { occ, canEdit } = await occurrenceForViewer(viewer, String(fd.get("id")));
  if (!canEdit) throw new AuthorizationError("Only people who manage chores can reassign them.");
  const assigneeId = await familyMemberIdOrNull(viewer.family.id, String(fd.get("assigneeId") || "") || null);
  // A day changed by hand stays put; the rest of the rotation carries on from this person.
  await db.update(choreOccurrences).set({ assigneeId, assignedManually: true }).where(eq(choreOccurrences.id, occ.id));
  const today = todayIn(viewer.family.timezone);
  await rebalanceRotations(viewer.family.id, occ.dueDate > today ? occ.dueDate : today);
  revalidateHouse();
}

/** Toggle one checklist item; completes the occurrence when all items are done. */
export async function setOccurrenceItemDone(fd: FormData) {
  const viewer = await getViewer();
  const itemId = String(fd.get("id"));
  const done = fd.get("done") === "true";
  const [item] = await db.select().from(choreOccurrenceItems).where(eq(choreOccurrenceItems.id, itemId));
  if (!item) return;
  const { occ, mine, canEdit, shared, title, kind } = await occurrenceForViewer(viewer, item.occurrenceId);
  if (!mine && !canEdit && !shared && item.assigneeId !== viewer.member.id) throw new AuthorizationError("That item isn't assigned to you.");
  if (shared && !done && item.completedByMemberId !== viewer.member.id) throw new AuthorizationError("Only the person who checked it (or a parent) can undo that.");
  await db
    .update(choreOccurrenceItems)
    .set(done ? { completedAt: new Date(), completedByMemberId: viewer.member.id } : { completedAt: null, completedByMemberId: null })
    .where(eq(choreOccurrenceItems.id, itemId));

  const remaining = await db
    .select({ id: choreOccurrenceItems.id })
    .from(choreOccurrenceItems)
    .where(and(eq(choreOccurrenceItems.occurrenceId, occ.id), isNull(choreOccurrenceItems.completedAt)));
  if (remaining.length === 0 && occ.status !== "done") {
    await db.update(choreOccurrences).set({ status: "done", completedAt: new Date(), completedByMemberId: viewer.member.id, pointsAwarded: pointsOf(occ.choreId) }).where(eq(choreOccurrences.id, occ.id));
    await logActivity(db, viewer.family.id, viewer.member.id, "chore.completed", `completed "${title}"`, { module: kindModule(kind), entityId: occ.choreId });
  } else if (remaining.length > 0 && occ.status === "done") {
    await db.update(choreOccurrences).set({ status: "pending", completedAt: null, completedByMemberId: null }).where(eq(choreOccurrences.id, occ.id));
  }
  revalidateHouse();
}

/** "Clean now": complete today's (or the oldest overdue) occurrence, or log an extra one for today. */
export async function cleanNow(fd: FormData) {
  const viewer = await getViewer();
  const [c] = await db.select().from(chores).where(and(eq(chores.id, String(fd.get("id"))), eq(chores.familyId, viewer.family.id)));
  if (!c) return;
  const today = todayIn(viewer.family.timezone);
  const [due] = await db
    .select()
    .from(choreOccurrences)
    .where(and(eq(choreOccurrences.choreId, c.id), eq(choreOccurrences.status, "pending"), lte(choreOccurrences.dueDate, today)))
    .orderBy(asc(choreOccurrences.dueDate))
    .limit(1);
  const [own] = due ? [] : await db.select().from(choreOccurrences).where(and(eq(choreOccurrences.choreId, c.id), eq(choreOccurrences.dueDate, today)));
  const target = due ?? own;
  if (!viewer.can(kindModule(c.kind), "use")) throw new AuthorizationError("You can view this but not check it off.");
  if (target && target.assigneeId !== viewer.member.id && c.kind !== "cleaning" && !viewer.can(kindModule(c.kind), "edit")) throw new AuthorizationError("That isn't assigned to you.");
  if (!target && !viewer.can(kindModule(c.kind))) throw new AuthorizationError("You can't log this.");
  const done = { status: "done" as const, completedAt: new Date(), completedByMemberId: viewer.member.id, pointsAwarded: pointsOf(c.id) };
  if (target) await db.update(choreOccurrences).set(done).where(eq(choreOccurrences.id, target.id));
  else await db.insert(choreOccurrences).values({ familyId: viewer.family.id, choreId: c.id, dueDate: today, assigneeId: viewer.member.id, ...done });
  await logActivity(db, viewer.family.id, viewer.member.id, "chore.completed", `completed "${c.title}"`, { module: kindModule(c.kind), entityId: c.id });
  revalidateHouse();
}

/** A completed (or skipped) record the viewer may correct: parents / Add & edit, or the person who did it. */
async function correctableRecord(viewer: Viewer, id: string, managersOnly = false) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AuthorizationError("Not found.");
  const [row] = await db
    .select({ occ: choreOccurrences, kind: chores.kind, title: chores.title })
    .from(choreOccurrences)
    .innerJoin(chores, eq(chores.id, choreOccurrences.choreId))
    .where(and(eq(choreOccurrences.id, id), eq(choreOccurrences.familyId, viewer.family.id)));
  if (!row) throw new AuthorizationError("Not found.");
  const manager = viewer.isParent || viewer.can(kindModule(row.kind), "edit");
  if (!manager && (managersOnly || row.occ.completedByMemberId !== viewer.member.id)) throw new AuthorizationError("Only a parent can change someone else's record.");
  return row;
}

/**
 * Put a done or skipped record back on the list as not done (it shows as
 * overdue if its day has passed). A done one gives back its points.
 */
export async function undoCompletion(fd: FormData) {
  const viewer = await getViewer();
  const { occ, title, kind } = await correctableRecord(viewer, String(fd.get("id")));
  const who = occ.completedByMemberId;
  await db
    .update(choreOccurrences)
    .set({ status: "pending", completedAt: null, completedByMemberId: null, pointsAwarded: null })
    .where(eq(choreOccurrences.id, occ.id));
  await db.update(choreOccurrenceItems).set({ completedAt: null, completedByMemberId: null }).where(eq(choreOccurrenceItems.occurrenceId, occ.id));
  if (who && who !== viewer.member.id)
    await logActivity(db, viewer.family.id, viewer.member.id, "chore.undone", `${occ.status === "skipped" ? "un-skipped" : "marked not done"} "${title}" (${occ.dueDate})${occ.pointsAwarded ? `, taking back ${occ.pointsAwarded} points` : ""}`, { module: kindModule(kind), entityId: occ.choreId });
  revalidateHouse();
  revalidatePath(`/house/chores/${occ.choreId}`);
}

/** Remove a record altogether (and any points it gave). Parents / Add & edit only. */
export async function deleteOccurrenceRecord(fd: FormData) {
  const viewer = await getViewer();
  const { occ, title, kind } = await correctableRecord(viewer, String(fd.get("id")), true);
  await db.delete(choreOccurrences).where(eq(choreOccurrences.id, occ.id));
  await logActivity(db, viewer.family.id, viewer.member.id, "chore.record_deleted", `deleted the ${occ.dueDate} record of "${title}"${occ.pointsAwarded ? ` (${occ.pointsAwarded} points removed)` : ""}`, { module: kindModule(kind), entityId: occ.choreId });
  revalidateHouse();
  revalidatePath(`/house/chores/${occ.choreId}`);
}
