import { and, count, eq, gt, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { familyMessages, messageReads } from "@/db/schema";

import { visibleChannels } from "./hub-shared";

export { CONTACT_CATEGORIES, CONTACT_LABEL, nextBirthday } from "./hub-shared";

/** Record that this person has seen the chat up to now. */
export async function markRead(familyId: string, memberId: string) {
  await db
    .insert(messageReads)
    .values({ familyId, memberId, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [messageReads.memberId, messageReads.familyId], set: { lastReadAt: new Date() } });
}

/** Messages from others since this person last opened the chat. */
export async function unreadMessages(familyId: string, memberId: string, isParent: boolean) {
  const [r] = await db.select({ at: messageReads.lastReadAt }).from(messageReads).where(and(eq(messageReads.memberId, memberId), eq(messageReads.familyId, familyId)));
  const [n] = await db
    .select({ n: count() })
    .from(familyMessages)
    .where(
      and(
        eq(familyMessages.familyId, familyId),
        ne(familyMessages.memberId, memberId),
        inArray(familyMessages.channel, visibleChannels(isParent)),
        r ? gt(familyMessages.createdAt, r.at) : undefined,
      ),
    );
  return n?.n ?? 0;
}
