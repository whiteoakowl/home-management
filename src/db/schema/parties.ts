import { boolean, date, index, integer, pgTable, text, time, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files, visibility } from "./core";

/** A birthday (or other) party someone is planning. Who sees it is the planner's choice. */
export const parties = pgTable(
  "parties",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").$type<"birthday" | "shower" | "holiday" | "graduation" | "other">().notNull().default("birthday"),
    /** Whose party (a family member), or a name for someone outside the family. */
    honoreeMemberId: uuid("honoree_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    honoreeName: text("honoree_name"),
    /** The age they're turning. */
    age: integer("age"),
    theme: text("theme"),
    date: date("date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    venue: text("venue"),
    address: text("address"),
    description: text("description"),
    rsvpBy: date("rsvp_by"),
    budgetCents: integer("budget_cents"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    visibility: visibility("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("parties_family_idx").on(t.familyId, t.date)],
);

/** Guest list with RSVPs, and what each guest brought (for thank-you notes). */
export const partyGuests = pgTable(
  "party_guests",
  {
    id: id(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contact: text("contact"),
    adults: integer("adults").notNull().default(1),
    kids: integer("kids").notNull().default(0),
    rsvp: text("rsvp").$type<"not_sent" | "invited" | "yes" | "maybe" | "no">().notNull().default("invited"),
    gift: text("gift"),
    thankYouSent: boolean("thank_you_sent").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("party_guests_party_idx").on(t.partyId)],
);

/** To-dos, food, decorations, supplies, activities, the day's schedule and expenses. */
export const partyItems = pgTable(
  "party_items",
  {
    id: id(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"todo" | "food" | "decor" | "supply" | "activity" | "schedule" | "expense">().notNull().default("todo"),
    title: text("title").notNull(),
    /** Due date (to-dos) or day (schedule). */
    date: date("date"),
    time: time("time"),
    quantity: text("quantity"),
    costCents: integer("cost_cents"),
    done: boolean("done").notNull().default(false),
    assignedMemberId: uuid("assigned_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("party_items_party_idx").on(t.partyId, t.kind)],
);
