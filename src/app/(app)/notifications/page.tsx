import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Bell, CheckCheck, Smartphone } from "lucide-react";
import { db } from "@/db";
import { notificationPreferences, notifications, pushSubscriptions } from "@/db/schema";
import { PushSetup } from "@/components/notifications/push-setup";
import { vapidPublicKey } from "@/lib/push";
import { clearRead, markAllRead, openNotification } from "@/app/actions/notifications";
import { ActionForm } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { savePreferences } from "@/app/actions/notifications";
import { getViewer } from "@/lib/dal";
import { relativeTime } from "@/lib/dates";
import { NOTIFICATION_KINDS } from "@/lib/notification-kinds";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await getViewer();
  const [rows, prefs, devices] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.memberId, viewer.member.id)).orderBy(desc(notifications.createdAt)).limit(100),
    db.select().from(notificationPreferences).where(eq(notificationPreferences.memberId, viewer.member.id)),
    db.select({ device: pushSubscriptions.device }).from(pushSubscriptions).where(eq(pushSubscriptions.memberId, viewer.member.id)),
  ]);
  const unread = rows.filter((r) => !r.readAt).length;
  const muted = new Set(prefs.filter((p) => !p.inApp).map((p) => p.kind));
  const kinds = NOTIFICATION_KINDS.filter((k) => k.key !== "budget_alert" || viewer.isParent);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <PageHeader
          title="Notifications"
          description={unread ? `${unread} unread` : "You're all caught up."}
          actions={
            <>
              {unread > 0 && (
                <ActionButton action={markAllRead} fields={{}} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                  <CheckCheck className="size-4" /> Mark all read
                </ActionButton>
              )}
              {rows.length > unread && (
                <ActionButton action={clearRead} fields={{}} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                  Clear read
                </ActionButton>
              )}
            </>
          }
        />
        <Card className="p-2 sm:p-2">
          {rows.length === 0 ? (
            <EmptyState icon={<Bell />} title="You're all caught up" description="Reminders for chores, events, expiring food, garden, farm, goals and workouts appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((n) => (
                <li key={n.id}>
                  <form action={openNotification}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className={cn("flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left hover:bg-sunken/60", !n.readAt && "bg-primary-50/50")}>
                      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary-500")} aria-hidden />
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className={cn("text-[15px]", !n.readAt && "font-semibold")}>{n.title}</span>
                        {n.body && <span className="text-sm text-muted">{n.body}</span>}
                        <span className="text-xs text-muted">{relativeTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="flex h-fit flex-col gap-6 lg:mt-[92px]">
        <Card id="push" className="scroll-mt-24">
          <CardHeader title="Push notifications" icon={<Smartphone className="size-4" />} />
          <PushSetup publicKey={vapidPublicKey()} />
          {devices.length > 0 && (
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              On for: {devices.map((d) => d.device ?? "a device").join(", ")}
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="What to notify me about" />
          <ActionForm action={savePreferences} submitLabel="Save preferences" resetOnSuccess={false} showSuccess>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm">
              <span />
              <span className="pb-1 text-center text-xs font-medium text-muted">In app</span>
              <span className="pb-1 text-center text-xs font-medium text-muted">Push</span>
              {kinds.map((k) => {
                const p = prefs.find((x) => x.kind === k.key);
                return (
                  <label key={k.key} className="contents">
                    <span className="border-t border-line py-2.5">
                      <span className="block text-[15px] font-medium">{k.label}</span>
                      <span className="block text-xs text-muted">{k.description}</span>
                    </span>
                    <span className="flex justify-center border-t border-line py-2.5">
                      {"pushOnly" in k && k.pushOnly ? <span className="text-muted">–</span> : <input type="checkbox" name={`app:${k.key}`} defaultChecked={!muted.has(k.key)} aria-label={`${k.label} in the app`} className="size-5 accent-primary-600" />}
                    </span>
                    <span className="flex justify-center border-t border-line py-2.5">
                      <input type="checkbox" name={`push:${k.key}`} defaultChecked={p ? p.push : true} aria-label={`${k.label} as push`} className="size-5 accent-primary-600" />
                    </span>
                  </label>
                );
              })}
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
