import { boolean, date, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { families, familyMembers, files } from "./core";

/**
 * Family Hub: the family's group chat, a shared address book and photo
 * albums (album photos live in entity_photos with entity_type 'album').
 */
export const familyMessages = pgTable(
  "family_messages",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    body: text("body"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("family_messages_family_idx").on(t.familyId, t.createdAt)],
);

/** When each person last opened the chat (for the unread count). */
export const messageReads = pgTable(
  "message_reads",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.familyId] })],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** family | friends | school | medical | childcare | neighbors | services | work | other */
    category: text("category").notNull().default("friends"),
    relationship: text("relationship"),
    phone: text("phone"),
    altPhone: text("alt_phone"),
    email: text("email"),
    address: text("address"),
    birthday: date("birthday"),
    notes: text("notes"),
    favorite: boolean("favorite").notNull().default(false),
    /** Private contacts are only visible to the person who added them. */
    private: boolean("private").notNull().default(false),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("contacts_family_idx").on(t.familyId)],
);

export const photoAlbums = pgTable(
  "photo_albums",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: date("event_date"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("photo_albums_family_idx").on(t.familyId)],
);
