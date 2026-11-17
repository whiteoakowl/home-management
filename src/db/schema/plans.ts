import { date, index, integer, pgTable, text, time, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files, visibility } from "./core";
import { goals } from "./personal";

/** A trip, vacation or big event someone is planning. Who sees it is the planner's choice. */
export const plans = pgTable(
  "plans",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").$type<"vacation" | "trip" | "event" | "other">().notNull().default("vacation"),
    destination: text("destination"),
    description: text("description"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    /** Who's going (family members). */
    memberIds: uuid("member_ids").array().notNull().default([]),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    /** A savings goal this plan is saving toward. */
    savingsGoalId: uuid("savings_goal_id").references(() => goals.id, { onDelete: "set null" }),
    budgetCents: integer("budget_cents"),
    visibility: visibility("visibility").notNull().default("family"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("plans_family_idx").on(t.familyId, t.startDate)],
);

/** One piece of a plan: an itinerary stop, a flight, a hotel stay, a vehicle, or a note. */
export const planItems = pgTable(
  "plan_items",
  {
    id: id(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"itinerary" | "flight" | "hotel" | "vehicle" | "note">().notNull().default("itinerary"),
    title: text("title").notNull(),
    date: date("date"),
    startTime: time("start_time"),
    endDate: date("end_date"),
    endTime: time("end_time"),
    /** Place, address, or for flights "From → To". */
    location: text("location"),
    /** Flight: departure / arrival airport codes. */
    fromPlace: text("from_place"),
    toPlace: text("to_place"),
    /** Airline + flight number, hotel name, rental company… */
    provider: text("provider"),
    confirmation: text("confirmation"),
    phone: text("phone"),
    link: text("link"),
    costCents: integer("cost_cents"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("plan_items_plan_idx").on(t.planId, t.date)],
);
