"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { choreChecklistItems, choreOccurrenceItems, choreOccurrences, chores, homeProjects, pets } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { materializeChore, rematerializeChore } from "@/lib/automation";
import { kindModule, type ChoreKind } from "@/lib/chores";
import { AuthorizationError, getViewer, type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { logActivity } from "@/lib/family";
import { ownedCategoryId, ownedId, ownedRoomId, ownedStageId } from "@/lib/queries";
import { f, familyMemberIdOrNull, upsertRule } from "@/lib/records";
import { CADENCE_PRESETS, ruleFromForm, type Rule } from "@/lib/recurrence";

const KINDS: ChoreKind[] = ["chore", "cleaning", "maintenance", "task"];
const CADENCES = ["daily", "weekly", "monthly", "seasonal", "biannual", "annual", "custom"] as const;
type Cadence = (typeof CADENCES)[number];

function revalidateHouse() {
  revalidatePath("/house", "layout");
  revalidatePath("/");
  revalidatePath("/calendar");
}

function requireKindEdit(viewer: Viewer, kind: ChoreKind) {
  if (!viewer.can(kindModule(kind), "edit")) throw new AuthorizationError("You don't have permission to manage these.");
}

/** Create or update a chore / cleaning / maintenance / task template. */
export async function saveChore(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await getViewer();
    const id = f.str(fd, "id");
    const kind = (f.str(fd, "kind") ?? "chore") as ChoreKind;
    if (!KINDS.includes(kind)) return fail("Unknown type.");
    requireKindEdit(viewer, kind);

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
      defaultAssigneeId: await familyMemberIdOrNull(viewer.family.id, f.str(fd, "assigneeId")),
      dueDate: rule ? null : f.date(fd, "dueDate"),
      notes: f.str(fd, "notes"),
      ...(fd.has("estimatedCost") ? { estimatedCostCents: f.cents(fd, "estimatedCost") } : {}),
      // Cross-module links are only touched when the form carries them.
      ...(fd.has("petId") ? { petId: await ownedId(viewer, pets, f.str(fd, "petId")) } : {}),
      ...(fd.has("projectId") ? { projectId: await ownedId(viewer, homeProjects, f.str(fd, "projectId")) } : {}),
      ...(fd.has("projectStageId") ? { projectStageId: await ownedStageId(viewer, f.str(fd, "projectStageId")) } : {}),
    };

    // Checklist rows come as parallel arrays: item[] + itemAssignee[]
    const texts = fd.getAll("item").map((v) => String(v).trim());
    const assignees = fd.getAll("itemAssignee").map((v) => String(v));
    const checklist: { text: string; assigneeId: string | null }[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (!texts[i]) continue;
      checklist.push({ text: texts[i]!.slice(0, 200), assigneeId: await familyMemberIdOrNull(viewer.family.id, assignees[i] || null) });
    }

    let choreId = id;
    await db.transaction(async (tx) => {
      if (id) {
        const [existing] = await tx.select().from(chores).where(and(eq(chores.id, id), eq(chores.familyId, viewer.family.id)));
        if (!existing) throw new AuthorizationError("Not found.");
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
    else {
      await materializeChore(choreId!, today);
      const noun = { chore: "a chore", cleaning: "a cleaning task", maintenance: "a maintenance task", task: "a task" }[kind];
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
  requireKindEdit(viewer, c.kind);
  await db.update(chores).set({ archivedAt: new Date() }).where(eq(chores.id, id));
  // Drop pending occurrences; completed history stays.
  await db.delete(choreOccurrences).where(and(eq(choreOccurrences.choreId, id), eq(choreOccurrences.status, "pending")));
  revalidateHouse();
  const back = String(fd.get("redirectTo") ?? "");
  if (back.startsWith("/house")) redirect(back);
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
  if (!mine && !assignedItem && !canEdit) throw new AuthorizationError("That isn't assigned to you.");
  return { ...row, mine, canEdit };
}

export async function setOccurrenceDone(fd: FormData) {
  const viewer = await getViewer();
  const id = String(fd.get("id"));
  const done = fd.get("done") === "true";
  const { occ, title, kind } = await occurrenceForViewer(viewer, id);
  await db
    .update(choreOccurrences)
    .set(
      done
        ? { status: "done", completedAt: new Date(), completedByMemberId: viewer.member.id }
        : { status: "pending", completedAt: null, completedByMemberId: null },
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
  const { occ } = await occurrenceForViewer(viewer, String(fd.get("id")));
  await db.update(choreOccurrences).set({ status: occ.status === "skipped" ? "pending" : "skipped" }).where(eq(choreOccurrences.id, occ.id));
  revalidateHouse();
}

export async function reassignOccurrence(fd: FormData) {
  const viewer = await getViewer();
  const { occ, canEdit } = await occurrenceForViewer(viewer, String(fd.get("id")));
  if (!canEdit) throw new AuthorizationError("Only people who manage chores can reassign them.");
  const assigneeId = await familyMemberIdOrNull(viewer.family.id, String(fd.get("assigneeId") || "") || null);
  await db.update(choreOccurrences).set({ assigneeId }).where(eq(choreOccurrences.id, occ.id));
  revalidateHouse();
}

/** Toggle one checklist item; completes the occurrence when all items are done. */
export async function setOccurrenceItemDone(fd: FormData) {
  const viewer = await getViewer();
  const itemId = String(fd.get("id"));
  const done = fd.get("done") === "true";
  const [item] = await db.select().from(choreOccurrenceItems).where(eq(choreOccurrenceItems.id, itemId));
  if (!item) return;
  const { occ, mine, canEdit, title, kind } = await occurrenceForViewer(viewer, item.occurrenceId);
  if (!mine && !canEdit && item.assigneeId !== viewer.member.id) throw new AuthorizationError("That item isn't assigned to you.");
  await db
    .update(choreOccurrenceItems)
    .set(done ? { completedAt: new Date(), completedByMemberId: viewer.member.id } : { completedAt: null, completedByMemberId: null })
    .where(eq(choreOccurrenceItems.id, itemId));

  const remaining = await db
    .select({ id: choreOccurrenceItems.id })
    .from(choreOccurrenceItems)
    .where(and(eq(choreOccurrenceItems.occurrenceId, occ.id), isNull(choreOccurrenceItems.completedAt)));
  if (remaining.length === 0 && occ.status !== "done") {
    await db.update(choreOccurrences).set({ status: "done", completedAt: new Date(), completedByMemberId: viewer.member.id }).where(eq(choreOccurrences.id, occ.id));
    await logActivity(db, viewer.family.id, viewer.member.id, "chore.completed", `completed "${title}"`, { module: kindModule(kind), entityId: occ.choreId });
  } else if (remaining.length > 0 && occ.status === "done") {
    await db.update(choreOccurrences).set({ status: "pending", completedAt: null, completedByMemberId: null }).where(eq(choreOccurrences.id, occ.id));
  }
  revalidateHouse();
}
