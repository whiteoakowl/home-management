import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  animalHealthRecords,
  animals,
  budgetLimits,
  calendarEvents,
  categories,
  choreChecklistItems,
  choreOccurrenceItems,
  choreOccurrences,
  chores,
  eventAttendees,
  families,
  familyMembers,
  fitnessPlans,
  gardenPlantings,
  inventoryItems,
  listItems,
  lists,
  memberPermissions,
  notificationPreferences,
  notifications,
  plants,
  recurrenceRules,
  transactions,
  workouts,
} from "@/db/schema";

type Family = typeof families.$inferSelect;
import { addDays, todayIn } from "./dates";
import { occurrencesBetween, type Rule } from "./recurrence";
import { MODULE_META } from "./modules";

/** Every automation can be switched off per family (Settings → Automations). */
export const AUTOMATIONS = [
  { key: "recurringChores", label: "Generate recurring chores", description: "Create upcoming chore & cleaning occurrences from their schedules." },
  { key: "missedChores", label: "Mark missed chores", description: "Chores left undone for 7 days are marked missed (kept in history)." },
  { key: "choreReminders", label: "Chore reminders", description: "Notify people about chores due today." },
  { key: "eventReminders", label: "Event reminders", description: "Notify attendees about today's events." },
  { key: "expirationAlerts", label: "Expiration alerts", description: "Notify about food expiring today or this week." },
  { key: "lowStockShopping", label: "Low stock → shopping list", description: "Add items below their low-stock level to the shopping list." },
  { key: "gardenReminders", label: "Garden reminders", description: "Notify about harvests coming up this week." },
  { key: "farmReminders", label: "Farm reminders", description: "Notify about animal health care that's due." },
  { key: "workoutReminders", label: "Workout reminders", description: "Notify people about workouts scheduled today." },
  { key: "workoutCalendar", label: "Workouts on calendar", description: "Show scheduled workouts on the family calendar." },
  { key: "budgetAlerts", label: "Budget alerts", description: "Notify parents when a category goes over its monthly limit." },
] as const;
export type AutomationKey = (typeof AUTOMATIONS)[number]["key"];

export const automationOn = (family: Pick<Family, "settings">, key: AutomationKey) => family.settings?.automations?.[key] !== false;

const HORIZON_DAYS = 14;

/** Expand one chore template into occurrences over the horizon (idempotent). */
export async function materializeChore(choreId: string, today: string) {
  const [c] = await db
    .select({ chore: chores, rule: recurrenceRules })
    .from(chores)
    .leftJoin(recurrenceRules, eq(recurrenceRules.id, chores.recurrenceRuleId))
    .where(eq(chores.id, choreId));
  if (!c || c.chore.archivedAt) return;
  const { chore, rule } = c;

  let dates: string[] = [];
  if (rule && rule.enabled) dates = occurrencesBetween(rule as unknown as Rule, today, addDays(today, HORIZON_DAYS));
  else if (chore.dueDate) dates = [chore.dueDate];
  if (!dates.length) return;

  const items = await db.select().from(choreChecklistItems).where(eq(choreChecklistItems.choreId, chore.id));
  const inserted = await db
    .insert(choreOccurrences)
    .values(dates.map((dueDate) => ({ familyId: chore.familyId, choreId: chore.id, dueDate, assigneeId: chore.defaultAssigneeId })))
    .onConflictDoNothing()
    .returning({ id: choreOccurrences.id });
  if (items.length && inserted.length) {
    await db.insert(choreOccurrenceItems).values(
      inserted.flatMap((o) =>
        items.map((it) => ({ occurrenceId: o.id, checklistItemId: it.id, text: it.text, assigneeId: it.assigneeId, position: it.position })),
      ),
    );
  }
}

/** Remove future, untouched occurrences (after a schedule edit) then re-expand. */
export async function rematerializeChore(choreId: string, today: string) {
  await db
    .delete(choreOccurrences)
    .where(and(eq(choreOccurrences.choreId, choreId), gte(choreOccurrences.dueDate, today), eq(choreOccurrences.status, "pending")));
  await materializeChore(choreId, today);
}

// ─── Notifications ───────────────────────────────────────────────────────────

/** Create a notification unless one with the same kind+title exists today, respecting preferences. */
export async function notify(
  familyId: string,
  memberIds: string[],
  n: { kind: string; title: string; body?: string; href?: string },
  today: string,
) {
  if (!memberIds.length) return;
  const muted = await db
    .select({ memberId: notificationPreferences.memberId })
    .from(notificationPreferences)
    .where(and(inArray(notificationPreferences.memberId, memberIds), eq(notificationPreferences.kind, n.kind), eq(notificationPreferences.inApp, false)));
  const mutedSet = new Set(muted.map((m) => m.memberId));
  const existing = await db
    .select({ memberId: notifications.memberId })
    .from(notifications)
    .where(
      and(
        inArray(notifications.memberId, memberIds),
        eq(notifications.kind, n.kind),
        eq(notifications.title, n.title),
        gte(notifications.createdAt, new Date(`${today}T00:00:00Z`)),
      ),
    );
  const done = new Set(existing.map((e) => e.memberId));
  const rows = memberIds.filter((m) => !mutedSet.has(m) && !done.has(m)).map((memberId) => ({ familyId, memberId, ...n }));
  if (rows.length) await db.insert(notifications).values(rows);
}

/** Members who can view a module (parents + members granted view/edit). */
async function viewersOf(familyId: string, module: keyof typeof MODULE_META) {
  const members = await db
    .select({ id: familyMembers.id, role: familyMembers.role, level: memberPermissions.level })
    .from(familyMembers)
    .leftJoin(memberPermissions, and(eq(memberPermissions.memberId, familyMembers.id), eq(memberPermissions.module, module)))
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.isActive, true)));
  const def = MODULE_META[module].defaultMemberAccess;
  return members.filter((m) => m.role === "parent" || (m.level ?? def) !== "none").map((m) => m.id);
}

async function parentsOf(familyId: string) {
  return (
    await db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.role, "parent"), eq(familyMembers.isActive, true)))
  ).map((m) => m.id);
}

// ─── Daily run ───────────────────────────────────────────────────────────────

/**
 * Daily automation for a family. Cheap and idempotent; throttled to once per
 * family per day via settings.lastAutomationOn. Called from the app layout.
 */
export async function runDailyAutomation(family: Family, force = false) {
  const today = todayIn(family.timezone);
  if (!force && family.settings?.lastAutomationOn === today) return;
  // Claim today's run first so concurrent requests don't double-run.
  const claimed = await db
    .update(families)
    .set({ settings: sql`jsonb_set(${families.settings}, '{lastAutomationOn}', to_jsonb(${today}::text))` })
    .where(and(eq(families.id, family.id), force ? sql`true` : sql`coalesce(${families.settings}->>'lastAutomationOn','') <> ${today}`))
    .returning({ id: families.id });
  if (!claimed.length) return;

  const fid = family.id;
  const on = (k: AutomationKey) => automationOn(family, k);
  const enabled = (m: string) => family.enabledModules.includes(m);

  if (on("recurringChores") && enabled("chores")) {
    const templates = await db
      .select({ id: chores.id })
      .from(chores)
      .where(and(eq(chores.familyId, fid), isNull(chores.archivedAt)));
    for (const t of templates) await materializeChore(t.id, today);
  }

  if (on("missedChores")) {
    await db
      .update(choreOccurrences)
      .set({ status: "missed" })
      .where(and(eq(choreOccurrences.familyId, fid), eq(choreOccurrences.status, "pending"), lt(choreOccurrences.dueDate, addDays(today, -7))));
  }

  if (on("choreReminders") && enabled("chores")) {
    const due = await db
      .select({ assigneeId: choreOccurrences.assigneeId, n: sql<number>`count(*)::int` })
      .from(choreOccurrences)
      .where(and(eq(choreOccurrences.familyId, fid), eq(choreOccurrences.dueDate, today), eq(choreOccurrences.status, "pending")))
      .groupBy(choreOccurrences.assigneeId);
    for (const d of due) {
      if (!d.assigneeId) continue;
      await notify(fid, [d.assigneeId], { kind: "chore_due", title: `${d.n} chore${d.n === 1 ? "" : "s"} due today`, href: "/house/chores" }, today);
    }
  }

  if (on("eventReminders") && enabled("calendar")) {
    const tz = family.timezone;
    const todays = await db
      .select({ id: calendarEvents.id, title: calendarEvents.title })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.familyId, fid),
          isNull(calendarEvents.recurrenceRuleId),
          sql`to_char(${calendarEvents.startsAt} at time zone ${tz}, 'YYYY-MM-DD') = ${today}`,
        ),
      );
    for (const e of todays) {
      const att = await db.select({ id: eventAttendees.memberId }).from(eventAttendees).where(eq(eventAttendees.eventId, e.id));
      await notify(fid, att.map((a) => a.id), { kind: "event_reminder", title: `Today: ${e.title}`, href: `/calendar/event/${e.id}` }, today);
    }
  }

  if (enabled("kitchen")) {
    if (on("expirationAlerts")) {
      const [{ today: t = 0, week = 0 } = {}] = await db
        .select({
          today: sql<number>`count(*) filter (where ${inventoryItems.expiresOn} <= ${today})::int`,
          week: sql<number>`count(*) filter (where ${inventoryItems.expiresOn} > ${today})::int`,
        })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.familyId, fid), isNull(inventoryItems.archivedAt), lte(inventoryItems.expiresOn, addDays(today, 7))));
      const who = await viewersOf(fid, "kitchen");
      if (t > 0) await notify(fid, who, { kind: "food_expiring", title: `${t} item${t === 1 ? "" : "s"} expiring today or expired`, href: "/kitchen?view=expiring" }, today);
      else if (week > 0) await notify(fid, who, { kind: "food_expiring", title: `${week} item${week === 1 ? "" : "s"} expiring this week`, href: "/kitchen?view=expiring" }, today);
    }
    if (on("lowStockShopping")) await addLowStockToShopping(fid);
  }

  if (on("gardenReminders") && enabled("garden")) {
    const soon = await db
      .select({ name: plants.name })
      .from(gardenPlantings)
      .innerJoin(plants, eq(plants.id, gardenPlantings.plantId))
      .where(and(eq(gardenPlantings.familyId, fid), gte(gardenPlantings.expectedHarvestOn, today), lte(gardenPlantings.expectedHarvestOn, addDays(today, 7))));
    if (soon.length) {
      const names = [...new Set(soon.map((s) => s.name))].slice(0, 3).join(", ");
      await notify(fid, await viewersOf(fid, "garden"), { kind: "garden_task", title: `Harvest coming up: ${names}`, href: "/garden" }, today);
    }
  }

  if (on("farmReminders") && enabled("farm")) {
    const due = await db
      .select({ animal: animals.name, kind: animalHealthRecords.kind, id: animals.id })
      .from(animalHealthRecords)
      .innerJoin(animals, eq(animals.id, animalHealthRecords.animalId))
      .where(and(eq(animals.familyId, fid), lte(animalHealthRecords.nextDueOn, addDays(today, 3)), gte(animalHealthRecords.nextDueOn, addDays(today, -14))));
    const who = await viewersOf(fid, "farm");
    for (const d of due) await notify(fid, who, { kind: "farm_task", title: `${d.animal}: ${d.kind} due`, href: `/farm/animals/${d.id}` }, today);
  }

  if (on("workoutReminders") && enabled("fitness")) {
    const scheduled = await db
      .select({ memberId: fitnessPlans.memberId, name: workouts.name, rule: recurrenceRules })
      .from(workouts)
      .innerJoin(fitnessPlans, eq(fitnessPlans.id, workouts.planId))
      .innerJoin(recurrenceRules, eq(recurrenceRules.id, workouts.recurrenceRuleId))
      .where(eq(fitnessPlans.familyId, fid));
    for (const s of scheduled) {
      if (occurrencesBetween(s.rule as unknown as Rule, today, today).length) {
        await notify(fid, [s.memberId], { kind: "fitness_reminder", title: `Workout today: ${s.name}`, href: "/fitness" }, today);
      }
    }
  }

  if (on("budgetAlerts") && enabled("budget")) {
    const monthStart = `${today.slice(0, 7)}-01`;
    const rows = await db
      .select({
        name: categories.name,
        limit: budgetLimits.monthlyCents,
        spent: sql<number>`coalesce((select sum(${transactions.amountCents}) from ${transactions} where ${transactions.categoryId} = ${categories.id} and ${transactions.kind} = 'expense' and ${transactions.date} >= ${monthStart} and ${transactions.date} <= ${today}),0)::int`,
      })
      .from(budgetLimits)
      .innerJoin(categories, eq(categories.id, budgetLimits.categoryId))
      .where(eq(budgetLimits.familyId, fid));
    const parents = await parentsOf(fid);
    for (const r of rows) {
      if (r.spent > r.limit) await notify(fid, parents, { kind: "budget_alert", title: `${r.name} is over budget this month`, href: "/budget" }, today);
    }
  }
}

/** Low-stock inventory → unchecked items on the main shopping list (no duplicates). */
export async function addLowStockToShopping(familyId: string) {
  const low = await db
    .select({ id: inventoryItems.id, name: inventoryItems.name, unit: inventoryItems.unit, location: inventoryItems.location })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.familyId, familyId),
        isNull(inventoryItems.archivedAt),
        sql`${inventoryItems.lowStockThreshold} is not null and ${inventoryItems.quantity} <= ${inventoryItems.lowStockThreshold}`,
      ),
    );
  if (!low.length) return 0;
  const listId = await mainShoppingListId(familyId);
  const already = await db
    .select({ sourceId: listItems.sourceId })
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.source, "low_stock"), eq(listItems.checked, false)));
  const have = new Set(already.map((a) => a.sourceId));
  const rows = low
    .filter((l) => !have.has(l.id))
    .map((l, i) => ({
      listId,
      text: l.name,
      unit: l.unit,
      source: "low_stock" as const,
      sourceId: l.id,
      shoppingCategory: (l.location === "freezer" ? "frozen" : l.location === "supplies" ? "household" : "pantry") as "frozen" | "household" | "pantry",
      position: 1000 + i,
    }));
  if (rows.length) await db.insert(listItems).values(rows);
  return rows.length;
}

/** The family's default shopping list, created on first use. */
export async function mainShoppingListId(familyId: string) {
  const [existing] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.familyId, familyId), eq(lists.kind, "shopping"), isNull(lists.archivedAt)))
    .orderBy(lists.createdAt)
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(lists).values({ familyId, title: "Groceries", kind: "shopping" }).returning({ id: lists.id });
  return created!.id;
}
