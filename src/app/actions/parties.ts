"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { familyMembers, listItems, parties, partyGuests, partyItems } from "@/db/schema";
import { fail, guard, ok, type ActionState } from "@/lib/action-state";
import { mainShoppingListId } from "@/lib/automation";
import { AuthorizationError, canChangeItem, requireModule, type Viewer } from "@/lib/dal";
import { saveUpload } from "@/lib/files";
import { checklistFor, getParty, ordinal } from "@/lib/parties";
import { f, saveRecordAccess, visibilityFromForm } from "@/lib/records";

/**
 * Party plans. Anyone with Party plans "Use" plans their own and chooses who
 * sees it; only its planner (or a parent) changes it.
 */
function revalidateParties(id?: string) {
  revalidatePath("/parties", "layout");
  if (id) revalidatePath(`/parties/${id}`);
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
}

const KINDS = ["birthday", "shower", "holiday", "graduation", "other"] as const;
const ITEM_KINDS = ["todo", "food", "decor", "supply", "activity", "schedule", "expense"] as const;
const RSVPS = ["not_sent", "invited", "yes", "maybe", "no"] as const;

async function changeableParty(viewer: Viewer, id: string) {
  const party = await getParty(viewer, id);
  if (!party) throw new AuthorizationError("Party not found.");
  if (!canChangeItem(viewer, party.p.createdByMemberId)) throw new AuthorizationError("Only the person planning this party (or a parent) can change it.");
  return party;
}

const time = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "");
  return /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
};

async function familyMemberOrNull(familyId: string, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [m] = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.id, id), eq(familyMembers.familyId, familyId)));
  return m?.id ?? null;
}

export async function saveParty(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("parties", "use");
    const id = f.str(fd, "id");
    const old = id ? (await changeableParty(viewer, id)).p : null;
    const honoreeMemberId = await familyMemberOrNull(viewer.family.id, f.str(fd, "honoreeMemberId"));
    const honoreeName = f.str(fd, "honoreeName");
    const kind = KINDS.find((k) => k === fd.get("kind")) ?? "birthday";
    const age = f.num(fd, "age");
    let title = f.str(fd, "title");
    if (!title && kind === "birthday" && (honoreeMemberId || honoreeName)) {
      const name = honoreeName ?? (await db.select({ n: familyMembers.displayName }).from(familyMembers).where(eq(familyMembers.id, honoreeMemberId!)))[0]?.n;
      if (name) title = `${name}'s ${age ? `${ordinal(Math.round(age))} ` : ""}birthday`;
    }
    if (!title) return fail("Name the party (e.g. Jack's 8th birthday).", "title");
    const image = await saveUpload(viewer, fd.get("image"));
    const { visibility, memberIds } = visibilityFromForm(fd);
    const values = {
      title: title.slice(0, 120),
      kind,
      honoreeMemberId,
      honoreeName: honoreeMemberId ? null : honoreeName,
      age: age !== null && age >= 0 && age < 150 ? Math.round(age) : null,
      theme: f.str(fd, "theme"),
      date: f.date(fd, "date"),
      startTime: time(fd, "startTime"),
      endTime: time(fd, "endTime"),
      venue: f.str(fd, "venue"),
      address: f.str(fd, "address"),
      description: f.str(fd, "description")?.slice(0, 4000) ?? null,
      rsvpBy: f.date(fd, "rsvpBy"),
      budgetCents: f.cents(fd, "budget"),
      visibility,
      ...(image ? { imageFileId: image } : {}),
    };
    let partyId = id;
    await db.transaction(async (tx) => {
      if (old) await tx.update(parties).set(values).where(eq(parties.id, old.id));
      else {
        const [row] = await tx.insert(parties).values({ ...values, familyId: viewer.family.id, createdByMemberId: viewer.member.id }).returning({ id: parties.id });
        partyId = row!.id;
        if (f.bool(fd, "checklist")) {
          await tx.insert(partyItems).values(checklistFor(values.date).map((c) => ({ partyId: partyId!, kind: "todo" as const, title: c.title, date: c.date })));
        }
      }
      await saveRecordAccess(tx, viewer.family.id, "party", partyId!, memberIds);
    });
    revalidateParties(partyId!);
    if (!id) redirect(`/parties/${partyId}`);
    return ok("Saved.");
  });
}

export async function deleteParty(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  const { p } = await changeableParty(viewer, String(fd.get("id")));
  await db.delete(parties).where(eq(parties.id, p.id));
  revalidateParties();
  redirect("/parties");
}

/** Add the starter checklist to an existing party (skipping ones already there). */
export async function addPartyChecklist(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  const { p, items } = await changeableParty(viewer, String(fd.get("id")));
  const have = new Set(items.filter((i) => i.kind === "todo").map((i) => i.title.toLowerCase()));
  const rows = checklistFor(p.date).filter((c) => !have.has(c.title.toLowerCase()));
  if (rows.length) await db.insert(partyItems).values(rows.map((c) => ({ partyId: p.id, kind: "todo" as const, title: c.title, date: c.date })));
  revalidateParties(p.id);
}

// ─── Guests ──────────────────────────────────────────────────────────────────

export async function savePartyGuest(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("parties", "use");
    const { p, guests } = await changeableParty(viewer, String(fd.get("partyId")));
    const id = f.str(fd, "id");
    if (id && !guests.some((g) => g.id === id)) throw new AuthorizationError("Guest not found.");
    // Several names at once: one per line.
    const names = id ? [f.str(fd, "name")].filter(Boolean) as string[] : String(fd.get("name") ?? "").split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return fail("Who's invited?", "name");
    const values = {
      contact: f.str(fd, "contact")?.slice(0, 200) ?? null,
      adults: Math.max(0, Math.round(f.num(fd, "adults") ?? 1)),
      kids: Math.max(0, Math.round(f.num(fd, "kids") ?? 0)),
      rsvp: RSVPS.find((r) => r === fd.get("rsvp")) ?? "invited",
      gift: f.str(fd, "gift")?.slice(0, 300) ?? null,
      thankYouSent: f.bool(fd, "thankYouSent"),
      notes: f.str(fd, "notes")?.slice(0, 2000) ?? null,
    };
    if (id) await db.update(partyGuests).set({ ...values, name: names[0]!.slice(0, 120) }).where(eq(partyGuests.id, id));
    else await db.insert(partyGuests).values(names.slice(0, 100).map((n) => ({ ...values, partyId: p.id, name: n.slice(0, 120) })));
    revalidateParties(p.id);
    return ok(id ? "Saved." : names.length > 1 ? `${names.length} guests added.` : `${names[0]} added.`);
  });
}

async function changeableGuest(viewer: Viewer, id: string) {
  const [g] = await db.select({ id: partyGuests.id, partyId: partyGuests.partyId }).from(partyGuests).where(eq(partyGuests.id, id));
  if (!g) throw new AuthorizationError("Guest not found.");
  await changeableParty(viewer, g.partyId);
  return g;
}

export async function setGuestRsvp(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  const g = await changeableGuest(viewer, String(fd.get("id")));
  const rsvp = RSVPS.find((r) => r === fd.get("rsvp"));
  if (!rsvp) return;
  await db.update(partyGuests).set({ rsvp }).where(eq(partyGuests.id, g.id));
  revalidateParties(g.partyId);
}

export async function toggleThankYou(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  const g = await changeableGuest(viewer, String(fd.get("id")));
  await db.update(partyGuests).set({ thankYouSent: fd.get("done") === "true" }).where(eq(partyGuests.id, g.id));
  revalidateParties(g.partyId);
}

export async function deletePartyGuest(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  const g = await changeableGuest(viewer, String(fd.get("id")));
  await db.delete(partyGuests).where(eq(partyGuests.id, g.id));
  revalidateParties(g.partyId);
}

// ─── To-dos, food, decorations, supplies, activities, schedule, expenses ─────

export async function savePartyItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const viewer = await requireModule("parties", "use");
    const { p, items } = await changeableParty(viewer, String(fd.get("partyId")));
    const id = f.str(fd, "id");
    if (id && !items.some((i) => i.id === id)) throw new AuthorizationError("Not found.");
    const title = f.str(fd, "title");
    if (!title) return fail("What is it?", "title");
    const kind = ITEM_KINDS.find((k) => k === fd.get("kind")) ?? "todo";
    const values = {
      kind,
      title: title.slice(0, 160),
      date: f.date(fd, "date") ?? (kind === "schedule" ? p.date : null),
      time: time(fd, "time"),
      quantity: f.str(fd, "quantity"),
      costCents: f.cents(fd, "cost"),
      assignedMemberId: await familyMemberOrNull(viewer.family.id, f.str(fd, "assignedMemberId")),
      notes: f.str(fd, "notes")?.slice(0, 2000) ?? null,
      ...(fd.has("done") ? { done: f.bool(fd, "done") } : {}),
    };
    if (id) await db.update(partyItems).set(values).where(eq(partyItems.id, id));
    else await db.insert(partyItems).values({ ...values, partyId: p.id, done: kind === "expense" });
    revalidateParties(p.id);
    return ok(id ? "Saved." : `${title} added.`);
  });
}

async function changeablePartyItem(viewer: Viewer, id: string) {
  const [i] = await db.select({ id: partyItems.id, partyId: partyItems.partyId }).from(partyItems).where(eq(partyItems.id, id));
  if (!i) throw new AuthorizationError("Not found.");
  await changeableParty(viewer, i.partyId);
  return i;
}

export async function togglePartyItem(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  const i = await changeablePartyItem(viewer, String(fd.get("id")));
  await db.update(partyItems).set({ done: fd.get("done") === "true" }).where(eq(partyItems.id, i.id));
  revalidateParties(i.partyId);
}

export async function deletePartyItem(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  const i = await changeablePartyItem(viewer, String(fd.get("id")));
  await db.delete(partyItems).where(eq(partyItems.id, i.id));
  revalidateParties(i.partyId);
}

/** Food, decorations and supplies not yet bought → the family shopping list. */
export async function partyToShopping(fd: FormData) {
  const viewer = await requireModule("parties", "use");
  if (!viewer.can("shopping", "add")) throw new AuthorizationError("You can't add to the shopping list.");
  const { p, items } = await changeableParty(viewer, String(fd.get("id")));
  const want = items.filter((i) => ["food", "decor", "supply"].includes(i.kind) && !i.done);
  if (!want.length) return;
  const listId = await mainShoppingListId(viewer.family.id);
  const already = new Set(
    (await db.select({ sourceId: listItems.sourceId }).from(listItems).where(and(eq(listItems.listId, listId), eq(listItems.checked, false), inArray(listItems.sourceId, want.map((i) => i.id))))).map((r) => r.sourceId),
  );
  const rows = want
    .filter((i) => !already.has(i.id))
    .map((i, n) => ({ listId, text: i.title, notes: [i.quantity, `For ${p.title}`].filter(Boolean).join(" · "), shoppingCategory: i.kind === "food" ? ("pantry" as const) : ("household" as const), sourceId: i.id, addedByMemberId: viewer.member.id, position: 1000 + n }));
  if (rows.length) await db.insert(listItems).values(rows);
  revalidatePath("/shopping", "layout");
  revalidateParties(p.id);
}
