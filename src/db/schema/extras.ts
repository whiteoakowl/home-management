import { boolean, date, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";
import { rooms } from "./household";

// ─── Rewards (points from chores) ────────────────────────────────────────────

/** Rewards parents offer for points ("Movie night pick", "$5 allowance"). */
export const rewards = pgTable(
  "rewards",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    emoji: text("emoji"),
    cost: integer("cost").notNull(),
    /** Optional: only these members may redeem (empty = everyone). */
    forMemberIds: uuid("for_member_ids").array().notNull().default([]),
    /** Cash value (e.g. allowance) recorded in the budget when fulfilled. */
    cashCents: integer("cash_cents"),
    active: boolean("active").notNull().default(true),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("rewards_family_idx").on(t.familyId)],
);

export const rewardRedemptions = pgTable(
  "reward_redemptions",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id").references(() => rewards.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    /** requested | approved | denied */
    status: text("status").notNull().default("requested"),
    decidedByMemberId: uuid("decided_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    decidedAt: date("decided_at"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("redemptions_family_idx").on(t.familyId, t.status)],
);

/** Manual bonuses / deductions by parents. */
export const pointAdjustments = pgTable(
  "point_adjustments",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("point_adj_member_idx").on(t.memberId)],
);

// ─── Home inventory & vendors ────────────────────────────────────────────────

/** Service providers: plumbers, electricians, vets, cleaners… */
export const vendors = pgTable(
  "vendors",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trade: text("trade"),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    address: text("address"),
    rating: integer("rating"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("vendors_family_idx").on(t.familyId)],
);

/** Belongings catalog for insurance and warranty purposes. */
export const homeItems = pgTable(
  "home_items",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** appliance | electronics | furniture | jewelry | art | tools | outdoor | instrument | sports | collectible | other */
    category: text("category").notNull().default("other"),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull().default(1),
    brand: text("brand"),
    model: text("model"),
    serialNumber: text("serial_number"),
    purchasedOn: date("purchased_on"),
    purchasedFrom: text("purchased_from"),
    purchasePriceCents: integer("purchase_price_cents"),
    currentValueCents: integer("current_value_cents"),
    warrantyExpiresOn: date("warranty_expires_on"),
    imageFileId: uuid("image_file_id").references(() => files.id, { onDelete: "set null" }),
    receiptFileId: uuid("receipt_file_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("home_items_family_idx").on(t.familyId)],
);
