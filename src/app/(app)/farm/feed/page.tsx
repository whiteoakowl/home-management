import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { Wheat } from "lucide-react";
import { db } from "@/db";
import { animals, feedLogs } from "@/db/schema";
import { FeedOrderCard } from "@/components/farm/feed-order-card";
import { FeedOrderModal } from "@/components/farm/feed-order-form";
import { FeedModal } from "@/components/farm/farm-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { canChangeItem, getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { animalOptions } from "@/lib/farm";
import { listFeedOrders } from "@/lib/feed";
import { getRecordAccess } from "@/lib/records";
import { memberOptions } from "@/lib/queries";
import { FarmTabs } from "../farm-tabs";

export const metadata: Metadata = { title: "Feed" };

/** Feed log: what we need to buy and by when (with who sees it), plus feed used. */
export default async function FarmFeedPage({ searchParams }: PageProps<"/farm/feed">) {
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const [open, bought, members, opts, used] = await Promise.all([
    listFeedOrders(viewer),
    listFeedOrders(viewer, { done: true, limit: 10 }),
    memberOptions(viewer),
    animalOptions(viewer),
    db
      .select({ id: feedLogs.id, date: feedLogs.date, feed: feedLogs.feed, quantity: feedLogs.quantity, unit: feedLogs.unit, costCents: feedLogs.costCents, animal: animals.name, group: feedLogs.groupName })
      .from(feedLogs)
      .leftJoin(animals, eq(animals.id, feedLogs.animalId))
      .where(and(eq(feedLogs.familyId, viewer.family.id), gte(feedLogs.date, addDays(today, -60))))
      .orderBy(desc(feedLogs.date))
      .limit(30),
  ]);
  const access = await getRecordAccess("feed_order", [...open, ...bought].filter((o) => o.visibility === "selected").map((o) => o.id));
  const canAdd = viewer.can("farm", "add");
  const canUse = viewer.can("farm", "use");
  const canShop = viewer.can("shopping", "add");
  const card = (o: (typeof open)[number]) => (
    <FeedOrderCard key={o.id} o={o} today={today} members={members} canUse={canUse} canChange={canChangeItem(viewer, o.createdByMemberId) || viewer.can("farm", "edit")} canShop={canShop} shared={access.get(o.id) ?? []} />
  );

  return (
    <>
      <PageHeader
        eyebrow="Farm"
        title="Feed"
        description="Feed we need to buy, by when, and who sees it. Open orders also show on the shopping list."
        actions={
          <>
            {viewer.can("farm", "edit") && <FeedModal animals={opts} />}
            {canAdd && <FeedOrderModal members={members} today={today} defaultOpen={sp.new === "1"} />}
          </>
        }
      />
      <FarmTabs active="feed" />
      <section aria-label="Feed needed">
        {open.length === 0 ? (
          <Card>
            <EmptyState icon={<Wheat />} title="No feed needed right now" description={canAdd ? "Add what you need to buy and when you need it by." : "Nothing on order."} example="“2 bags layer pellets, 1 bale hay” by Friday" />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{open.map(card)}</div>
        )}
      </section>
      {bought.length > 0 && (
        <section className="mt-8" aria-label="Recently bought">
          <h2 className="mb-3 text-lg font-semibold">Recently bought</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{bought.map(card)}</div>
        </section>
      )}
      <Card className="mt-8">
        <CardHeader title="Feed used (last 60 days)" />
        {used.length === 0 ? (
          <p className="text-sm text-muted">Use “Log feed” to track how much each animal eats and what it costs.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[15px]">
            {used.map((u) => (
              <li key={u.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {u.feed} <span className="text-muted">· {[u.animal ?? u.group, formatShortDate(u.date)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {Number(u.quantity)} {u.unit}
                  {u.costCents ? <span className="text-muted"> · ${(u.costCents / 100).toFixed(2)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
