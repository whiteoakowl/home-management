import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { families, notificationPreferences, pushSubscriptions } from "@/db/schema";

/**
 * Web push (phones and computers). Needs three environment variables:
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (make a pair once with
 * `npx web-push generate-vapid-keys`) and VAPID_SUBJECT (mailto: or https: contact).
 * Without them, push is simply off and everything else works as before.
 */
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY?.trim() || null;
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:support@example.com", process.env.VAPID_PUBLIC_KEY!.trim(), process.env.VAPID_PRIVATE_KEY!.trim());
  ready = true;
  return true;
}

export type PushMessage = { title: string; body?: string; href?: string; tag?: string };

/** Quiet hours (9pm–7am in the family's time zone): reminders wait for the app instead of buzzing phones. */
export function isQuietHour(timezone: string, now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now));
  return h >= 21 || h < 7;
}

/**
 * Send a push to every device of these members. `kind` is a notification kind:
 * members who switched push off for it are skipped. Never throws; dead
 * subscriptions are removed.
 */
export async function sendPush(memberIds: string[], kind: string | null, msg: PushMessage, opts: { ignoreQuietHours?: boolean } = {}) {
  if (!memberIds.length || !setup()) return { sent: 0 };
  try {
    let ids = [...new Set(memberIds)];
    if (kind) {
      const off = await db
        .select({ memberId: notificationPreferences.memberId })
        .from(notificationPreferences)
        .where(and(inArray(notificationPreferences.memberId, ids), eq(notificationPreferences.kind, kind), eq(notificationPreferences.push, false)));
      const mute = new Set(off.map((o) => o.memberId));
      ids = ids.filter((m) => !mute.has(m));
    }
    if (!ids.length) return { sent: 0 };
    const subs = await db
      .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth, tz: families.timezone })
      .from(pushSubscriptions)
      .innerJoin(families, eq(families.id, pushSubscriptions.familyId))
      .where(inArray(pushSubscriptions.memberId, ids));
    const payload = JSON.stringify({ title: msg.title.slice(0, 120), body: msg.body?.slice(0, 300), href: msg.href?.startsWith("/") ? msg.href : "/", tag: msg.tag });
    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      subs
        .filter((s) => opts.ignoreQuietHours || !isQuietHour(s.tz))
        .map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, timeout: 5000 });
            sent++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) dead.push(s.id);
            else console.error("Push failed:", code ?? (e as Error).message);
          }
        }),
    );
    if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
    return { sent };
  } catch (e) {
    console.error("Push failed:", e);
    return { sent: 0 };
  }
}
