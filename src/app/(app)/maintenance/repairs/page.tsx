import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Hammer } from "lucide-react";
import { db } from "@/db";
import { homeRepairs } from "@/db/schema";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { todayIn } from "@/lib/dates";
import { roomOpts } from "@/lib/maintenance";
import { REPAIR_STATUSES } from "@/lib/maintenance-config";
import { RepairModal, maintViewer } from "../shared";

export const metadata: Metadata = { title: "Repair log" };

export default async function RepairsPage({ searchParams }: PageProps<"/maintenance/repairs">) {
  const viewer = await maintViewer();
  const sp = (await searchParams) as { status?: string; room?: string; q?: string };
  const today = todayIn(viewer.family.timezone);
  const [rooms, rows] = await Promise.all([roomOpts(viewer), db.select().from(homeRepairs).where(eq(homeRepairs.familyId, viewer.family.id)).orderBy(desc(homeRepairs.reportedOn))]);
  const q = sp.q?.toLowerCase();
  const shown = rows.filter((r) => (!sp.status || r.status === sp.status) && (!sp.room || r.roomId === sp.room) && (!q || `${r.title} ${r.problem} ${r.contractor} ${r.notes}`.toLowerCase().includes(q)));
  const total = shown.reduce((s, r) => s + (r.costCents ?? 0), 0);
  const canEdit = viewer.can("maintenance", "edit");
  const add = canEdit ? <RepairModal rooms={rooms} canBudget={viewer.can("budget", "edit")} today={today} /> : undefined;
  const sel = "h-10 rounded-full border border-line-strong bg-surface px-3 text-sm";
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="Repair log" description="A permanent history of every repair: problem, fix, contractor, cost, warranty and before/after photos." actions={add} />
      <MaintenanceTabs active="repairs" />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search repairs…" aria-label="Search repairs" className="h-10 min-w-48 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={sel}>
          <option value="">Any status</option>
          {REPAIR_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="room" defaultValue={sp.room ?? ""} aria-label="Room" className={sel}>
          <option value="">Every room</option>
          {rooms.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white">Filter</button>
      </form>
      {shown.length ? (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id}>
                <Link href={`/maintenance/repairs/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-sunken/50 sm:px-5">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-sm text-muted">{[rooms.find((x) => x.value === r.roomId)?.label, r.contractor, r.problem].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Badge tone={r.status === "completed" ? "primary" : r.status === "scheduled" ? "olive" : "wine"}>{r.status}</Badge>
                  <span className="w-24 text-right text-sm">{r.costCents ? fmtMoney(r.costCents) : "—"}</span>
                  <span className="w-28 text-right text-sm text-muted">{fmtDate(r.completedOn ?? r.scheduledOn ?? r.reportedOn)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-right text-sm">
            Total: <strong>{fmtMoney(total)}</strong>
          </p>
        </Card>
      ) : (
        <Card>
          <EmptyState icon={<Hammer />} title={rows.length ? "No repairs match" : "No repairs logged"} description="Log what broke, how it was fixed and what it cost, so you have the history when you need it." action={!rows.length && add} />
        </Card>
      )}
    </>
  );
}
