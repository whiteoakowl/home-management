import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { categories, families, familyMembers, visibility } from "./core";
import { priority, recurrenceRules } from "./household";

export const listKind = pgEnum("list_kind", [
  "checklist",
  "bullet",
  "numbered",
  "todo",
  "shopping",
]);
export const shoppingCategory = pgEnum("shopping_category", [
  "produce",
  "meat",
  "dairy",
  "pantry",
  "frozen",
  "household",
  "personal",
  "garden",
  "farm",
  "other",
]);
export const listItemSource = pgEnum("list_item_source", [
  "manual",
  "recipe",
  "meal_plan",
  "low_stock",
]);

/** One engine for every list type, including shopping lists. */
export const lists = pgTable(
  "lists",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: listKind("kind").notNull().default("checklist"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    store: text("store"),
    roomId: uuid("room_id"),
    projectId: uuid("project_id"),
    visibility: visibility("visibility").notNull().default("family"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("lists_family_kind_idx").on(t.familyId, t.kind)],
);

export const listItems = pgTable(
  "list_items",
  {
    id: id(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull().default(0),
    checked: boolean("checked").notNull().default(false),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    checkedByMemberId: uuid("checked_by_member_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    // To-do fields
    dueDate: date("due_date"),
    priority: priority("priority"),
    assigneeId: uuid("assignee_id").references(() => familyMembers.id, {
      onDelete: "set null",
    }),
    recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, {
      onDelete: "set null",
    }),
    // Shopping fields
    quantity: numeric("quantity"),
    unit: text("unit"),
    shoppingCategory: shoppingCategory("shopping_category"),
    store: text("store"),
    source: listItemSource("source").notNull().default("manual"),
    /** recipe id / meal_plan_entry id / inventory_item id depending on source */
    sourceId: uuid("source_id"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("list_items_list_idx").on(t.listId, t.position)],
);
