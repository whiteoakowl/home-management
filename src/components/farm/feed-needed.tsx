import Link from "next/link";
import { Wheat } from "lucide-react";
import { canChangeItem, type Viewer } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { listFeedOrders } from "@/lib/feed";
import { memberOptions } from "@/lib/queries";
import { dueLabel, FeedOrderCard } from "./feed-order-card";

/** "Feed needed" beside the family shopping list: open feed orders the viewer can see. */
export async function FeedNeeded({ viewer }: { viewer: Viewer }) {
  if (!viewer.can("farm")) return null;
  const orders = await listFeedOrders(viewer);
  if (!orders.length) return null;
  const today = todayIn(viewer.family.timezone);
  const members = await memberOptions(viewer);
  const next = dueLabel(orders[0]!.dueDate, today);
  return (
    <details className="group rounded-2xl border border-olive-300 bg-olive-50/60 p-3" open={orders.some((o) => o.dueDate <= addDays(today, 2)) || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <Wheat className="size-4 text-olive-700" aria-hidden />
        Feed needed
        <span className="rounded-full bg-surface px-2 text-xs font-medium text-muted">{orders.length}</span>
        <span className="ml-auto text-xs font-medium text-olive-700">{next.text}</span>
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {orders.map((o) => (
          <FeedOrderCard key={o.id} o={o} today={today} members={members} canUse={viewer.can("farm", "use")} canChange={canChangeItem(viewer, o.createdByMemberId) || viewer.can("farm", "edit")} canShop={viewer.can("shopping", "add")} compact />
        ))}
      </div>
      <Link href="/farm/feed" className="mt-2 inline-block text-sm font-medium text-primary-700 hover:underline">
        Open the feed log →
      </Link>
    </details>
  );
}
