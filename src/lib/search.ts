import "server-only";
import { and, eq, ilike, inArray, isNull, or, sql, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  allergies,
  celebrations,
  craftItems,
  foodRestrictions,
  homeItems,
  homeProjects,
  homeRepairs,
  vendors,
  medicalConditions,
  medicalDocuments,
  medications,
  pets,
  rooms,
  animals,
  calendarEvents,
  chores,
  familyMembers,
  fitnessPlans,
  goals,
  homeDocuments,
  householdInfo,
  inventoryItems,
  journalEntries,
  listItems,
  lists,
  plants,
  recipeIngredients,
  recipes,
  transactions,
  workoutLogs,
} from "@/db/schema";
import { visibleTo, type Viewer } from "./dal";
import { utcToZoned } from "./dates";
import { craftVisible } from "./craft";
import { medicalVisible } from "./medical";

export type SearchHit = { id: string; title: string; subtitle?: string | null; href: string };
export type SearchGroup = { key: string; label: string; icon: string; hits: SearchHit[] };

const LIMIT = 8;

/** Permission-aware search across every area of the app. */
export async function globalSearch(viewer: Viewer, raw: string): Promise<SearchGroup[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const fid = viewer.family.id;
  const tasks: Promise<SearchGroup | null>[] = [];
  const group = (key: string, label: string, icon: string, p: Promise<SearchHit[]>) =>
    tasks.push(p.then((hits) => (hits.length ? { key, label, icon, hits } : null)));

  group(
    "people",
    "People",
    "Users",
    db
      .select({ id: familyMembers.id, title: familyMembers.displayName, role: familyMembers.role })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, fid), eq(familyMembers.isActive, true), ilike(familyMembers.displayName, like)))
      .limit(LIMIT)
      .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: x.role === "parent" ? "Parent" : "Family member", href: `/family/${x.id}` }))),
  );

  if (viewer.can("chores") || viewer.can("house") || viewer.can("maintenance")) {
    const kinds = [...(viewer.can("chores") ? ["chore", "task"] : []), ...(viewer.can("house") ? ["cleaning"] : []), ...(viewer.can("maintenance") ? ["maintenance"] : [])] as ("chore" | "task" | "cleaning" | "maintenance")[];
    group(
      "chores",
      "Chores & tasks",
      "ListChecks",
      db
        .select({ id: chores.id, title: chores.title, kind: chores.kind })
        .from(chores)
        .where(and(eq(chores.familyId, fid), isNull(chores.archivedAt), inArray(chores.kind, kinds), or(ilike(chores.title, like), ilike(chores.description, like), ilike(chores.instructions, like))))
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: x.kind[0]!.toUpperCase() + x.kind.slice(1), href: `/house/chores/${x.id}` }))),
    );
  }

  if (viewer.can("calendar")) {
    group(
      "events",
      "Events",
      "CalendarDays",
      db
        .select({ id: calendarEvents.id, title: calendarEvents.title, startsAt: calendarEvents.startsAt, location: calendarEvents.location })
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.familyId, fid),
            visibleTo(viewer, { id: calendarEvents.id, visibility: calendarEvents.visibility, author: calendarEvents.createdByMemberId }, "event"),
            or(ilike(calendarEvents.title, like), ilike(calendarEvents.location, like), ilike(calendarEvents.description, like)),
          ),
        )
        .orderBy(sql`${calendarEvents.startsAt} desc`)
        .limit(LIMIT)
        .then((r) =>
          r.map((x) => ({
            id: x.id,
            title: x.title,
            subtitle: [new Date(`${utcToZoned(x.startsAt, viewer.family.timezone).date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), x.location].filter(Boolean).join(" · "),
            href: `/calendar/event/${x.id}`,
          })),
        ),
    );
  }

  if (viewer.can("recipes")) {
    group(
      "recipes",
      "Recipes",
      "BookOpen",
      db
        .select({ id: recipes.id, title: recipes.name, description: recipes.description })
        .from(recipes)
        .where(
          and(
            eq(recipes.familyId, fid),
            or(ilike(recipes.name, like), sql`${q.toLowerCase()} = any(${recipes.tags})`, sql`exists (select 1 from ${recipeIngredients} ri where ri.recipe_id = ${recipes.id} and ri.name ilike ${like})`),
          ),
        )
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: x.description, href: `/recipes/${x.id}` }))),
    );
  }

  if (viewer.can("kitchen")) {
    group(
      "inventory",
      "Kitchen inventory",
      "Refrigerator",
      db
        .select({ id: inventoryItems.id, title: inventoryItems.name, qty: inventoryItems.quantity, unit: inventoryItems.unit, location: inventoryItems.location })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.familyId, fid), isNull(inventoryItems.archivedAt), ilike(inventoryItems.name, like)))
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: `${Number(x.qty)} ${x.unit ?? ""} · ${x.location}`, href: `/kitchen?view=${["pantry", "fridge", "freezer", "supplies", "pets", "craft", "home"].includes(x.location) ? x.location : "all"}` }))),
    );
  }

  if (viewer.can("lists") || viewer.can("shopping")) {
    const listVis = visibleTo(viewer, { id: lists.id, visibility: lists.visibility, author: lists.createdByMemberId }, "list");
    const kindsOk = or(viewer.can("lists") ? sql`${lists.kind} <> 'shopping'` : sql`false`, viewer.can("shopping") ? eq(lists.kind, "shopping") : sql`false`);
    group(
      "lists",
      "Lists",
      "ClipboardList",
      db
        .selectDistinct({ id: lists.id, title: lists.title, kind: lists.kind })
        .from(lists)
        .leftJoin(listItems, eq(listItems.listId, lists.id))
        .where(and(eq(lists.familyId, fid), isNull(lists.archivedAt), listVis, kindsOk, or(ilike(lists.title, like), ilike(listItems.text, like))))
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: x.kind === "shopping" ? "Shopping list" : `${x.kind[0]!.toUpperCase()}${x.kind.slice(1)} list`, href: `${x.kind === "shopping" ? "/shopping" : "/lists"}/${x.id}` }))),
    );
  }

  if (viewer.can("garden")) {
    group(
      "plants",
      "Plants",
      "Sprout",
      db
        .select({ id: plants.id, title: plants.name, variety: plants.variety, category: plants.category })
        .from(plants)
        .where(and(or(isNull(plants.familyId), eq(plants.familyId, fid)), or(ilike(plants.name, like), ilike(plants.variety, like))))
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.variety ? `${x.title} · ${x.variety}` : x.title, subtitle: x.category, href: `/garden/plants/${x.id}` }))),
    );
  }

  if (viewer.can("farm")) {
    group(
      "animals",
      "Animals",
      "PawPrint",
      db
        .select({ id: animals.id, title: animals.name, species: animals.species, breed: animals.breed })
        .from(animals)
        .where(and(eq(animals.familyId, fid), or(ilike(animals.name, like), ilike(animals.species, like), ilike(animals.breed, like), ilike(animals.groupName, like))))
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: [x.species, x.breed].filter(Boolean).join(" · "), href: `/farm/animals/${x.id}` }))),
    );
  }

  if (viewer.can("journal")) {
    group(
      "journal",
      "Journal",
      "NotebookPen",
      db
        .select({ id: journalEntries.id, title: journalEntries.title, body: journalEntries.body, date: journalEntries.date })
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.familyId, fid),
            ne(journalEntries.book, "grimoire"),
            visibleTo(viewer, { id: journalEntries.id, visibility: journalEntries.visibility, author: journalEntries.authorMemberId }, "journal_entry", { parentsSeePrivate: false }),
            or(ilike(journalEntries.title, like), ilike(journalEntries.body, like), sql`${q.toLowerCase()} = any(${journalEntries.tags})`),
          ),
        )
        .orderBy(sql`${journalEntries.date} desc`)
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title ?? x.body.slice(0, 60), subtitle: new Date(`${x.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), href: `/journal/${x.id}` }))),
    );
  }

  if (viewer.can("goals")) {
    group(
      "goals",
      "Goals",
      "Target",
      db
        .select({ id: goals.id, title: goals.name, kind: goals.kind })
        .from(goals)
        .where(and(eq(goals.familyId, fid), visibleTo(viewer, { id: goals.id, visibility: goals.visibility, author: goals.ownerMemberId }, "goal"), or(ilike(goals.name, like), ilike(goals.description, like))))
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: `${x.kind} goal`, href: `/goals/${x.id}` }))),
    );
  }

  if (viewer.can("budget")) {
    group(
      "budget",
      "Budget",
      "Wallet",
      db
        .select({ id: transactions.id, title: transactions.name, cents: transactions.amountCents, date: transactions.date, kind: transactions.kind })
        .from(transactions)
        .where(and(eq(transactions.familyId, fid), or(ilike(transactions.name, like), ilike(transactions.notes, like))))
        .orderBy(sql`${transactions.date} desc`)
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: `${x.kind === "income" ? "+" : "−"}$${(x.cents / 100).toFixed(2)} · ${x.date}`, href: `/budget/transactions?month=${x.date.slice(0, 7)}` }))),
    );
  }

  if (viewer.can("fitness")) {
    const mine = viewer.isParent ? sql`true` : eq(workoutLogs.memberId, viewer.member.id);
    group(
      "fitness",
      "Fitness",
      "Dumbbell",
      Promise.all([
        db
          .select({ id: fitnessPlans.id, title: fitnessPlans.name, memberId: fitnessPlans.memberId })
          .from(fitnessPlans)
          .where(and(eq(fitnessPlans.familyId, fid), viewer.isParent ? sql`true` : eq(fitnessPlans.memberId, viewer.member.id), ilike(fitnessPlans.name, like)))
          .limit(4),
        db.select({ id: workoutLogs.id, title: workoutLogs.title, date: workoutLogs.date, memberId: workoutLogs.memberId }).from(workoutLogs).where(and(eq(workoutLogs.familyId, fid), mine, ilike(workoutLogs.title, like))).limit(4),
      ]).then(([p, l]) => [
        ...p.map((x) => ({ id: x.id, title: x.title, subtitle: "Fitness plan", href: `/fitness/plans/${x.id}` })),
        ...l.map((x) => ({ id: x.id, title: x.title, subtitle: `Workout · ${x.date}`, href: `/fitness?member=${x.memberId}` })),
      ]),
    );
  }

  if (viewer.can("house") || viewer.can("maintenance")) {
    group(
      "house",
      "Household info & documents",
      "House",
      Promise.all([
        !viewer.can("house") ? Promise.resolve([]) : db
          .select({ id: householdInfo.id, title: householdInfo.title })
          .from(householdInfo)
          .where(and(eq(householdInfo.familyId, fid), visibleTo(viewer, { id: householdInfo.id, visibility: householdInfo.visibility, author: householdInfo.createdByMemberId }, "household_info"), or(ilike(householdInfo.title, like), ilike(householdInfo.body, like))))
          .limit(4),
        !viewer.can("maintenance") ? Promise.resolve([]) : db
          .select({ id: homeDocuments.id, title: homeDocuments.title })
          .from(homeDocuments)
          .where(and(eq(homeDocuments.familyId, fid), visibleTo(viewer, { id: homeDocuments.id, visibility: homeDocuments.visibility, author: homeDocuments.createdByMemberId }, "document"), or(ilike(homeDocuments.title, like), ilike(homeDocuments.notes, like))))
          .limit(4),
      ]).then(([i, d]) => [
        ...i.map((x) => ({ id: x.id, title: x.title, subtitle: "Important info", href: "/house/info" })),
        ...d.map((x) => ({ id: x.id, title: x.title, subtitle: "Document", href: "/maintenance/documents" })),
      ]),
    );
  }

  if (viewer.can("medical")) {
    // Only records the viewer may see; titles only (no clinical details in results).
    const kinds = [
      ["allergy", allergies, allergies.name, "Allergy", "/medical/allergies"],
      ["restriction", foodRestrictions, foodRestrictions.title, "Food restriction", "/medical/diet"],
      ["condition", medicalConditions, medicalConditions.name, "Condition", "/medical/conditions"],
      ["medication", medications, medications.name, "Medication", "/medical/medications"],
      ["document", medicalDocuments, medicalDocuments.title, "Medical document", "/medical/documents"],
    ] as const;
    group(
      "medical",
      "Medical",
      "HeartPulse",
      Promise.all(
        kinds.map(([, t, col, label, href]) =>
          db
            .select({ id: t.id, title: col, member: familyMembers.displayName })
            .from(t)
            .innerJoin(familyMembers, eq(familyMembers.id, t.memberId))
            .where(and(eq(t.familyId, fid), medicalVisible(viewer, t), ilike(col, like)))
            .limit(3)
            .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: `${label} · ${x.member}`, href }))),
        ),
      ).then((g) => g.flat().slice(0, LIMIT)),
    );
  }

  if (viewer.can("pets")) {
    group(
      "pets",
      "Pets",
      "PawPrint",
      db
        .select({ id: pets.id, title: pets.name, species: pets.species, breed: pets.breed })
        .from(pets)
        .where(and(eq(pets.familyId, fid), or(ilike(pets.name, like), ilike(pets.breed, like), ilike(pets.notes, like))))
        .limit(LIMIT)
        .then((r) => r.map((x) => ({ id: x.id, title: x.title, subtitle: [x.species, x.breed].filter(Boolean).join(" · "), href: `/pets/${x.id}` }))),
    );
  }

  if (viewer.can("witchcraft")) {
    group(
      "craft",
      "Witchcraft",
      "Moon",
      Promise.all([
        db
          .select({ id: craftItems.id, title: craftItems.name, kind: craftItems.kind })
          .from(craftItems)
          .where(and(craftVisible(viewer), or(ilike(craftItems.name, like), ilike(craftItems.description, like))))
          .limit(6),
        db
          .select({ id: journalEntries.id, title: journalEntries.title, body: journalEntries.body })
          .from(journalEntries)
          .where(
            and(
              eq(journalEntries.familyId, fid),
              eq(journalEntries.book, "grimoire"),
              visibleTo(viewer, { id: journalEntries.id, visibility: journalEntries.visibility, author: journalEntries.authorMemberId }, "journal_entry", { parentsSeePrivate: false }),
              or(ilike(journalEntries.title, like), ilike(journalEntries.body, like)),
            ),
          )
          .limit(3),
        db.select({ id: celebrations.id, title: celebrations.name, date: celebrations.date }).from(celebrations).where(and(eq(celebrations.familyId, fid), ilike(celebrations.name, like))).limit(3),
      ]).then(([items, gr, cel]) => [
        ...items.map((x) => ({ id: x.id, title: x.title, subtitle: x.kind[0]!.toUpperCase() + x.kind.slice(1), href: `/witchcraft/item/${x.id}` })),
        ...gr.map((x) => ({ id: x.id, title: x.title ?? x.body.slice(0, 60), subtitle: "Grimoire", href: "/witchcraft/grimoire" })),
        ...cel.map((x) => ({ id: x.id, title: x.title, subtitle: `Celebration · ${x.date}`, href: `/witchcraft/celebrations/${x.id}` })),
      ]),
    );
  }

  if (viewer.can("maintenance")) {
    group(
      "home",
      "Home maintenance",
      "Hammer",
      Promise.all([
        db.select({ id: rooms.id, title: rooms.name, kind: rooms.kind }).from(rooms).where(and(eq(rooms.familyId, fid), or(ilike(rooms.name, like), ilike(rooms.description, like)))).limit(3),
        db.select({ id: homeRepairs.id, title: homeRepairs.title }).from(homeRepairs).where(and(eq(homeRepairs.familyId, fid), or(ilike(homeRepairs.title, like), ilike(homeRepairs.problem, like), ilike(homeRepairs.contractor, like)))).limit(4),
        db.select({ id: homeProjects.id, title: homeProjects.title }).from(homeProjects).where(and(eq(homeProjects.familyId, fid), or(ilike(homeProjects.title, like), ilike(homeProjects.description, like)))).limit(4),
        db.select({ id: homeItems.id, title: homeItems.name, model: homeItems.model }).from(homeItems).where(and(eq(homeItems.familyId, fid), or(ilike(homeItems.name, like), ilike(homeItems.brand, like), ilike(homeItems.model, like), ilike(homeItems.serialNumber, like)))).limit(4),
        db.select({ id: vendors.id, title: vendors.name, phone: vendors.phone }).from(vendors).where(and(eq(vendors.familyId, fid), or(ilike(vendors.name, like), ilike(vendors.trade, like), ilike(vendors.contactName, like)))).limit(4),
      ]).then(([r, rep, pr, items, vs]) => [
        ...r.map((x) => ({ id: x.id, title: x.title, subtitle: x.kind === "system" ? "Home system" : "Room", href: `/maintenance/rooms/${x.id}` })),
        ...rep.map((x) => ({ id: x.id, title: x.title, subtitle: "Repair", href: `/maintenance/repairs/${x.id}` })),
        ...pr.map((x) => ({ id: x.id, title: x.title, subtitle: "Project", href: `/maintenance/projects/${x.id}` })),
        ...items.map((x) => ({ id: x.id, title: x.title, subtitle: `Home inventory${x.model ? ` · ${x.model}` : ""}`, href: "/maintenance/inventory" })),
        ...vs.map((x) => ({ id: x.id, title: x.title, subtitle: `Service provider${x.phone ? ` · ${x.phone}` : ""}`, href: "/maintenance/vendors" })),
      ]),
    );
  }

  return (await Promise.all(tasks)).filter((g): g is SearchGroup => !!g);
}
