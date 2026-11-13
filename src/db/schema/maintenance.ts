import { boolean, date, index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";
import { homeProjects, rooms } from "./household";
import { inventoryItems } from "./kitchen";

/** Permanent home repair history. */
export const homeRepairs = pgTable(
  "home_repairs",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    /** open | scheduled | completed */
    status: text("status").notNull().default("open"),
    reportedOn: date("reported_on").notNull(),
    scheduledOn: date("scheduled_on"),
    completedOn: date("completed_on"),
    problem: text("problem"),
    repairPerformed: text("repair_performed"),
    contractor: text("contractor"),
    vendorId: uuid("vendor_id"),
    costCents: integer("cost_cents"),
    materials: text("materials"),
    warrantyInfo: text("warranty_info"),
    warrantyExpiresOn: date("warranty_expires_on"),
    notes: text("notes"),
    reportedByMemberId: uuid("reported_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("repairs_family_idx").on(t.familyId, t.reportedOn)],
);

/** Photos for repairs & projects: before, after, receipt, inspiration, progress, plan. */
export const homePhotos = pgTable(
  "home_photos",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    repairId: uuid("repair_id").references(() => homeRepairs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => homeProjects.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("progress"),
    caption: text("caption"),
    ...timestamps,
  },
  (t) => [index("home_photos_repair_idx").on(t.repairId), index("home_photos_project_idx").on(t.projectId)],
);

export const projectStages = pgTable(
  "project_stages",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => homeProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dueOn: date("due_on"),
    done: boolean("done").notNull().default(false),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("project_stages_idx").on(t.projectId)],
);

export const projectMaterials = pgTable(
  "project_materials",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => homeProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity"),
    unit: text("unit"),
    estimatedCostCents: integer("estimated_cost_cents"),
    store: text("store"),
    productInfo: text("product_info"),
    purchased: boolean("purchased").notNull().default(false),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("project_materials_idx").on(t.projectId)],
);
