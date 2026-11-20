"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { z } from "zod";
import { notificationPreferences, notifications, pushSubscriptions } from "@/db/schema";
import { pushConfigured, sendPush } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
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
    const inApp = "pushOnly" in k && k.pushOnly ? true : fd.get(`app:${k.key}`) === "on";
    const push = fd.get(`push:${k.key}`) === "on";
    await db
      .insert(notificationPreferences)
      .values({ memberId: viewer.member.id, kind: k.key, inApp, push })
      .onConflictDoUpdate({ target: [notificationPreferences.memberId, notificationPreferences.kind], set: { inApp, push } });
  }
  revalidatePath("/notifications");
  return ok("Preferences saved.");
}

// ─── Push on this device ─────────────────────────────────────────────────────

const Sub = z.object({ endpoint: z.string().url().startsWith("https://").max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

/** Save this browser's push subscription for the signed-in member. */
export async function savePushSubscription(json: unknown, device?: string): Promise<{ ok: boolean; message?: string }> {
  const viewer = await getViewer();
  if (!pushConfigured()) return { ok: false, message: "Push notifications aren't set up for this app yet." };
  const parsed = Sub.safeParse(json);
  if (!parsed.success) return { ok: false, message: "This device sent an invalid subscription." };
  const { endpoint, keys } = parsed.data;
  const values = { familyId: viewer.family.id, memberId: viewer.member.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, device: device?.slice(0, 120) ?? null };
  // The same browser moves to whoever signs in on it.
  await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  revalidatePath("/notifications");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, String(endpoint).slice(0, 1000)), eq(pushSubscriptions.memberId, viewer.member.id)));
  revalidatePath("/notifications");
  return { ok: true };
}

/** Send a test push to all of my devices. */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const viewer = await getViewer();
  const ok = await rateLimit(`push-test:${viewer.member.id}`, 5, 60 * 10).catch(() => true);
  if (!ok) return { ok: false, message: "Too many tests. Try again in a few minutes." };
  const { sent } = await sendPush([viewer.member.id], null, { title: `Hi ${viewer.member.displayName.split(" ")[0]}! 👋`, body: "Push notifications are working on this device.", href: "/notifications", tag: "test" }, { ignoreQuietHours: true });
  return sent ? { ok: true, message: `Sent to ${sent} device${sent === 1 ? "" : "s"}.` } : { ok: false, message: "Nothing was sent. Turn on push for this device first." };
}
