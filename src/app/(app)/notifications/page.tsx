import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Bell, CheckCheck } from "lucide-react";
import { db } from "@/db";
import { notificationPreferences, notifications } from "@/db/schema";
import { clearRead, markAllRead, openNotification } from "@/app/actions/notifications";
import { ActionForm } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { Toggle } from "@/components/ui/form";
import { savePreferences } from "@/app/actions/notifications";
import { getViewer } from "@/lib/dal";
import { relativeTime } from "@/lib/dates";
import { NOTIFICATION_KINDS } from "@/lib/notification-kinds";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await getViewer();
  const [rows, prefs] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.memberId, viewer.member.id)).orderBy(desc(notifications.createdAt)).limit(100),
    db.select().from(notificationPreferences).where(eq(notificationPreferences.memberId, viewer.member.id)),
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
      <Card className="h-fit lg:mt-[92px]">
        <CardHeader title="What to notify me about" />
        <ActionForm action={savePreferences} submitLabel="Save preferences" resetOnSuccess={false} showSuccess>
          <div className="flex flex-col divide-y divide-line">
            {kinds.map((k) => (
              <Toggle key={k.key} name={`pref:${k.key}`} label={k.label} description={k.description} defaultChecked={!muted.has(k.key)} />
            ))}
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
