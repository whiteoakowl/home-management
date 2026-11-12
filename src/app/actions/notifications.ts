"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences, notifications } from "@/db/schema";
import { ok, type ActionState } from "@/lib/action-state";
import { getViewer } from "@/lib/dal";
import { NOTIFICATION_KINDS } from "@/lib/notification-kinds";

/** Mark one notification read, then open what it points to. */
export async function openNotification(fd: FormData) {
  const viewer = await getViewer();
  const [n] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, String(fd.get("id"))), eq(notifications.memberId, viewer.member.id)))
    .returning();
  revalidatePath("/", "layout");
  if (n?.href && n.href.startsWith("/")) redirect(n.href);
}

export async function markAllRead() {
  const viewer = await getViewer();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.memberId, viewer.member.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}

export async function clearRead() {
  const viewer = await getViewer();
  await db.delete(notifications).where(and(eq(notifications.memberId, viewer.member.id), isNotNull(notifications.readAt)));
  revalidatePath("/notifications");
}

export async function savePreferences(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  for (const k of NOTIFICATION_KINDS) {
    await db
      .insert(notificationPreferences)
      .values({ memberId: viewer.member.id, kind: k.key, inApp: fd.get(`pref:${k.key}`) === "on" })
      .onConflictDoUpdate({ target: [notificationPreferences.memberId, notificationPreferences.kind], set: { inApp: fd.get(`pref:${k.key}`) === "on" } });
  }
  revalidatePath("/notifications");
  return ok("Preferences saved.");
}
