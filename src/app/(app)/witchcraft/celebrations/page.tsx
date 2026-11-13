import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CalendarHeart } from "lucide-react";
import { db } from "@/db";
import { celebrations } from "@/db/schema";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { sabbatByKey } from "@/lib/sabbats";
import { craftViewer } from "../shared";
import { CelebrationModal } from "./celebration-modal";

export const metadata: Metadata = { title: "Celebrations" };

export default async function CelebrationsPage() {
  const viewer = await craftViewer();
  const today = todayIn(viewer.family.timezone);
  const rows = await db.select().from(celebrations).where(eq(celebrations.familyId, viewer.family.id)).orderBy(asc(celebrations.date));
  const upcoming = rows.filter((r) => r.date >= today);
  const past = rows.filter((r) => r.date < today).reverse();
  const canEdit = viewer.can("witchcraft", "edit");
  const Item = ({ c }: { c: (typeof rows)[number] }) => {
    const s = c.sabbat ? sabbatByKey(c.sabbat) : null;
    const img = fileUrl(c.imageFileId, true);
    return (
      <Link href={`/witchcraft/celebrations/${c.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50 text-3xl">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden>{s?.emoji ?? "🕯️"}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{c.name}</span>
          <span className="text-sm text-muted">
            {fmtDate(c.date)}
            {c.budgetCents ? ` · budget ${fmtMoney(c.budgetCents)}` : ""}
          </span>
        </span>
        {s && <Badge tone="olive">{s.name}</Badge>}
      </Link>
    );
  };
  return (
    <>
      <PageHeader eyebrow="Witchcraft" title="Celebrations" description="Sabbat feasts, moon gatherings and personal celebrations, with guests, decorations, ritual plans, recipes and shopping." actions={canEdit && <CelebrationModal />} />
      <CraftTabs active="celebrations" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarHeart />} title="No celebrations planned" description="Plan one from any sabbat on the Wheel of the Year, or start from scratch." action={canEdit && <CelebrationModal />} />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {upcoming.map((c) => (
            <Item key={c.id} c={c} />
          ))}
          {past.length > 0 && <h2 className="mt-4 text-lg font-semibold">Past celebrations</h2>}
          {past.map((c) => (
            <Item key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}
