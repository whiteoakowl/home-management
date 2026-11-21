import { boolean, date, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    /** all (everyone) | parents | kids | announcements */
    channel: text("channel").notNull().default("all"),
    /** text | photo | file | poll | event */
    kind: text("kind").notNull().default("text"),
    /** A calendar event shared in the chat (event cards). */
    eventId: uuid("event_id"),
    /** Poll question and options. */
    poll: jsonb("poll").$type<{ question: string; options: { id: string; text: string }[]; multiple?: boolean }>(),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedByMemberId: uuid("pinned_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("family_messages_family_idx").on(t.familyId, t.createdAt), index("family_messages_channel_idx").on(t.familyId, t.channel, t.createdAt)],
);

/** Emoji reactions on chat messages (one row per person per emoji). */
export const messageReactions = pgTable(
  "message_reactions",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => familyMessages.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.memberId, t.emoji] })],
);

/** Votes on chat polls (one per person per poll). */
export const pollVotes = pgTable(
  "poll_votes",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => familyMessages.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    optionId: text("option_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.memberId] })],
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
    /** Someone's own album (e.g. "Jack's album"); null = a family album. */
    ownerMemberId: uuid("owner_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    /** Only the person who made it can see it. */
    private: boolean("private").notNull().default(false),
    /** The trip this album belongs to (Plans). */
    planId: uuid("plan_id"),
    createdByMemberId: uuid("created_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("photo_albums_family_idx").on(t.familyId)],
);

/**
 * Gift wishlists. Everyone keeps their own; others can quietly claim or mark
 * an item bought, which the wishlist's owner never sees (keeps the surprise).
 */
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: id(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    link: text("link"),
    priceCents: integer("price_cents"),
    /** 1 = really want · 2 = would love · 3 = nice to have */
    priority: smallint("priority").notNull().default(2),
    /** Size, color, model… */
    details: text("details"),
    occasion: text("occasion").notNull().default("Holidays"),
    claimedByMemberId: uuid("claimed_by_member_id").references(() => familyMembers.id, { onDelete: "set null" }),
    purchased: boolean("purchased").notNull().default(false),
    /** The owner marks it received; it moves to their "Got it" list. */
    received: boolean("received").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("wishlist_items_member_idx").on(t.familyId, t.memberId)],
);
