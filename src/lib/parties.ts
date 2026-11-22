import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { parties, partyGuests, partyItems } from "@/db/schema";
import { addDays } from "./dates";
import { visibleTo, type Viewer } from "./dal";

/** Parties the viewer may see: their own, the family's, or ones shared with them. */
export const partyVisible = (viewer: Viewer) => visibleTo(viewer, { id: parties.id, visibility: parties.visibility, author: parties.createdByMemberId }, "party");

export async function listParties(viewer: Viewer) {
  if (!viewer.can("parties")) return [];
  return db
    .select({
      p: parties,
      yes: sql<number>`(select coalesce(sum(${partyGuests.adults} + ${partyGuests.kids}), 0)::int from ${partyGuests} where ${partyGuests.partyId} = ${parties.id} and ${partyGuests.rsvp} = 'yes')`,
      invited: sql<number>`(select count(*)::int from ${partyGuests} where ${partyGuests.partyId} = ${parties.id})`,
      todos: sql<number>`(select count(*)::int from ${partyItems} where ${partyItems.partyId} = ${parties.id} and ${partyItems.kind} = 'todo')`,
      todosDone: sql<number>`(select count(*)::int from ${partyItems} where ${partyItems.partyId} = ${parties.id} and ${partyItems.kind} = 'todo' and ${partyItems.done})`,
    })
    .from(parties)
    .where(and(eq(parties.familyId, viewer.family.id), partyVisible(viewer)))
    .orderBy(asc(parties.date), asc(parties.title));
}

export async function getParty(viewer: Viewer, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !viewer.can("parties")) return null;
  const [p] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.id, id), eq(parties.familyId, viewer.family.id), partyVisible(viewer)));
  if (!p) return null;
  const [guests, items] = await Promise.all([
    db.select().from(partyGuests).where(eq(partyGuests.partyId, id)).orderBy(asc(partyGuests.name)),
    db.select().from(partyItems).where(eq(partyItems.partyId, id)).orderBy(asc(partyItems.date), asc(partyItems.time), asc(partyItems.createdAt)),
  ]);
  return { p, guests, items };
}

/** A starter checklist, timed back from the party date. */
export const PARTY_CHECKLIST: { title: string; daysBefore: number }[] = [
  { title: "Set the budget and guest count", daysBefore: 42 },
  { title: "Pick a theme", daysBefore: 42 },
  { title: "Book the venue (or plan the space at home)", daysBefore: 35 },
  { title: "Make the guest list", daysBefore: 35 },
  { title: "Send invitations", daysBefore: 28 },
  { title: "Book entertainment or plan games", daysBefore: 21 },
  { title: "Order the cake", daysBefore: 14 },
  { title: "Buy decorations, plates and favors", daysBefore: 10 },
  { title: "Plan the menu and drinks", daysBefore: 10 },
  { title: "Follow up on RSVPs", daysBefore: 7 },
  { title: "Make the party playlist", daysBefore: 5 },
  { title: "Grocery shop for the party", daysBefore: 2 },
  { title: "Pick up the cake", daysBefore: 1 },
  { title: "Charge the camera and phones", daysBefore: 1 },
  { title: "Decorate and set up", daysBefore: 0 },
  { title: "Send thank-you notes", daysBefore: -7 },
];

export function checklistFor(date: string | null) {
  return PARTY_CHECKLIST.map((c) => ({ title: c.title, date: date ? addDays(date, -c.daysBefore) : null }));
}

export const RSVP_LABEL: Record<string, string> = { not_sent: "Not invited yet", invited: "Waiting", yes: "Coming", maybe: "Maybe", no: "Can't come" };
export const ITEM_KIND_LABEL: Record<string, string> = { todo: "To-do", food: "Food & drinks", decor: "Decorations", supply: "Supplies & favors", activity: "Games & activities", schedule: "Party schedule", expense: "Expense" };

/** 1st, 2nd, 3rd, 4th, 11th, 21st… */
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
