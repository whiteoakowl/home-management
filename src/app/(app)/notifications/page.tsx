import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await getViewer();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.memberId, viewer.member.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" description="Chore reminders, events, expiring food and more." />
      <Card className="p-2 sm:p-2">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Bell />}
            title="You're all caught up"
            description="Reminders for chores, events, expiring food and goal milestones will appear here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((n) => {
              const body = (
                <div className={cn("flex flex-col gap-0.5 px-4 py-3", !n.readAt && "border-l-4 border-primary-500")}>
                  <span className="font-medium">{n.title}</span>
                  {n.body && <span className="text-sm text-muted">{n.body}</span>}
                  <span className="text-xs text-muted">{relativeTime(n.createdAt)}</span>
                </div>
              );
              return <li key={n.id}>{n.href ? <Link href={n.href} className="block hover:bg-sunken">{body}</Link> : body}</li>;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
