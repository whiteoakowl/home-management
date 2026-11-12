import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartColumn } from "lucide-react";
import { BarChart, HBarList } from "@/components/charts";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { LinkTabs, SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { progressOf } from "@/lib/goals";
import { budgetReport, cleaningReport, farmReport, fitnessReport, gardenReport, goalsReport, kitchenReport } from "@/lib/reports";
import { formatCents } from "@/lib/utils";
import type { Module } from "@/db/schema/_shared";

export const metadata: Metadata = { title: "Reports" };

const TABS: { key: string; label: string; module: Module }[] = [
  { key: "cleaning", label: "Cleaning & chores", module: "chores" },
  { key: "garden", label: "Garden", module: "garden" },
  { key: "farm", label: "Farm", module: "farm" },
  { key: "kitchen", label: "Kitchen", module: "kitchen" },
  { key: "budget", label: "Budget", module: "budget" },
  { key: "fitness", label: "Fitness", module: "fitness" },
  { key: "goals", label: "Goals", module: "goals" },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl font-semibold">{value}</p>
    </Card>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const viewer = await getViewer();
  if (!viewer.can("reports")) notFound();
  const sp = await searchParams;
  const tabs = TABS.filter((t) => viewer.can(t.module));
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? tabs[0]?.key;
  const today = todayIn(viewer.family.timezone);
  const days = sp.range === "90" ? 90 : 30;
  if (!tab) {
    return (
      <Card>
        <EmptyState icon={<ChartColumn />} title="No reports available" description="Reports appear for the areas you have access to." />
      </Card>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Money" title="Reports" description="History and trends across the household." />
      <LinkTabs active={tab} tabs={tabs.map((t) => ({ key: t.key, href: `/reports?tab=${t.key}`, label: t.label }))} />

      {tab === "cleaning" && <CleaningTab today={today} days={days} />}
      {tab === "garden" && <GardenTab today={today} />}
      {tab === "farm" && <FarmTab today={today} />}
      {tab === "kitchen" && <KitchenTab today={today} />}
      {tab === "budget" && <BudgetTab today={today} />}
      {tab === "fitness" && <FitnessTab today={today} />}
      {tab === "goals" && <GoalsTab />}
    </>
  );

  async function CleaningTab({ today, days }: { today: string; days: number }) {
    const r = await cleaningReport(viewer, today, days);
    const done = r.byMember.reduce((s, m) => s + m.done, 0);
    const missed = r.byMember.reduce((s, m) => s + m.missed, 0);
    return (
      <div className="flex flex-col gap-6">
        <SegmentLinks active={String(days)} items={[{ key: "30", href: "/reports?tab=cleaning&range=30", label: "30 days" }, { key: "90", href: "/reports?tab=cleaning&range=90", label: "90 days" }]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Completed" value={done} />
          <Stat label="Missed" value={missed} />
          <Stat label="Completion rate" value={done + missed ? `${Math.round((done / (done + missed)) * 100)}%` : "—"} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Completed by person" />
            {r.byMember.length ? <HBarList data={r.byMember.map((m) => ({ label: `${m.name} (${m.missed} missed)`, value: m.done }))} valueFormat={{ suffix: "done" }} /> : <p className="text-sm text-muted">No assigned chores in this period.</p>}
          </Card>
          <Card>
            <CardHeader title="By chore" />
            {r.byChore.length ? (
              <ul className="flex flex-col gap-1.5 text-[15px]">
                {r.byChore.slice(0, 12).map((c) => (
                  <li key={c.title} className="flex justify-between gap-2">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 text-sm">
                      <strong>{c.done}</strong> done{c.missed ? <span className="text-wine-500"> · {c.missed} missed</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing yet.</p>
            )}
          </Card>
        </div>
        <Card>
          <CardHeader title="Who completed what, and when" />
          {r.history.length === 0 ? (
            <p className="text-sm text-muted">Completed chores and cleaning will be listed here.</p>
          ) : (
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-4 font-medium">Chore</th>
                  <th className="py-2 pr-4 font-medium">Completed by</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {r.history.map((h) => (
                  <tr key={h.id} className="border-b border-line/60">
                    <td className="py-2 pr-4">
                      {h.title} <Badge className="ml-1">{h.kind}</Badge>
                    </td>
                    <td className="py-2 pr-4">{h.by ?? "—"}</td>
                    <td className="py-2 text-sm text-muted">{h.completedAt?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: viewer.family.timezone })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    );
  }

  async function GardenTab({ today }: { today: string }) {
    const r = await gardenReport(viewer, today);
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Harvests per month" />
          <BarChart data={r.monthly} series={[{ name: "Harvests" }]} label="Garden harvests per month" valueFormat={{ suffix: "harvests" }} />
        </Card>
        <Card>
          <CardHeader title="Harvested by plant" />
          {r.harvests.length ? (
            <HBarList data={r.harvests.map((h) => ({ label: `${h.plant} (${h.unit ?? ""})`, value: h.total }))} />
          ) : (
            <p className="text-sm text-muted">Log harvests to see totals.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="What was planted, and when" />
          {r.planted.length ? (
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {r.planted.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{p.plant}</span>
                  <span className="text-sm text-muted">
                    {p.kind} · {formatShortDate(p.date)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Log plantings in the garden log.</p>
          )}
        </Card>
      </div>
    );
  }

  async function FarmTab({ today }: { today: string }) {
    const r = await farmReport(viewer, today);
    return (
      <div className="flex flex-col gap-6">
        {r.series.length === 0 && (
          <Card>
            <EmptyState icon={<ChartColumn />} title="No production yet" description="Record eggs, milk and more on the Farm page." action={<Link href="/farm/production" className="text-sm font-semibold text-primary-600">Farm production →</Link>} />
          </Card>
        )}
        {r.series.map((s) => (
          <Card key={`${s.kind}${s.unit}`}>
            <CardHeader title={`${s.kind[0]!.toUpperCase()}${s.kind.slice(1)} per month (${s.unit})`} />
            <BarChart data={s.data} series={[{ name: s.kind }]} label={`${s.kind} per month`} valueFormat={{ suffix: s.unit }} />
          </Card>
        ))}
        {r.feed.length > 0 && (
          <Card>
            <CardHeader title="Feed usage (12 months)" />
            <HBarList data={r.feed.map((f) => ({ label: `${f.feed} (${f.unit})${f.cost ? ` · ${formatCents(f.cost)}` : ""}`, value: f.total }))} />
          </Card>
        )}
      </div>
    );
  }

  async function KitchenTab({ today }: { today: string }) {
    const r = await kitchenReport(viewer, today);
    const wasteRate = r.used + r.discarded ? Math.round((r.discarded / (r.used + r.discarded)) * 100) : 0;
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Items added" value={r.added} />
          <Stat label="Used" value={r.used} />
          <Stat label="Discarded" value={r.discarded} />
          <Stat label="Waste rate" value={`${wasteRate}%`} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader title="Used vs. discarded (6 months)" />
            <BarChart data={r.usage} series={[{ name: "Used" }, { name: "Discarded" }]} label="Kitchen items used and discarded per month" />
          </Card>
          <Card>
            <CardHeader title="Most wasted" />
            {r.wasted.length ? <HBarList data={r.wasted.map((w) => ({ label: w.name, value: w.n }))} valueFormat={{ suffix: "×" }} /> : <p className="text-sm text-muted">Nothing discarded. Great job!</p>}
          </Card>
        </div>
      </div>
    );
  }

  async function BudgetTab({ today }: { today: string }) {
    const r = await budgetReport(viewer, today);
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Income (12 mo)" value={formatCents(r.income)} />
          <Stat label="Expenses (12 mo)" value={formatCents(r.expenses)} />
          <Stat label="Saved (12 mo)" value={formatCents(r.saved)} />
          <Stat label="Savings rate" value={r.income ? `${Math.round((r.saved / r.income) * 100)}%` : "—"} />
        </div>
        <Card>
          <CardHeader title="Income vs. expenses" />
          <BarChart data={r.monthly} series={[{ name: "Income" }, { name: "Expenses" }]} label="Income and expenses per month" valueFormat={{ currency: true }} />
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Spending by category (12 mo)" />
            {r.byCategory.length ? <HBarList data={r.byCategory.map((c) => ({ label: c.name, value: c.total / 100 }))} valueFormat={{ currency: true }} /> : <p className="text-sm text-muted">No expenses yet.</p>}
          </Card>
          <Card>
            <CardHeader title="Saved per month" />
            <BarChart data={r.savings} series={[{ name: "Saved" }]} label="Savings per month" valueFormat={{ currency: true }} height={180} />
          </Card>
        </div>
      </div>
    );
  }

  async function FitnessTab({ today }: { today: string }) {
    const r = await fitnessReport(viewer, today);
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Workouts per week" />
          <BarChart data={r.weekly} series={[{ name: "Workouts" }]} label="Family workouts per week" />
        </Card>
        <Card>
          <CardHeader title="By person (12 weeks)" />
          {r.perPerson.length ? <HBarList data={r.perPerson.map((p) => ({ label: `${p.label} · ${p.minutes} min`, value: p.value }))} valueFormat={{ suffix: "workouts" }} /> : <p className="text-sm text-muted">No workouts logged.</p>}
        </Card>
      </div>
    );
  }

  async function GoalsTab() {
    const r = await goalsReport(viewer);
    const active = r.all.filter((g) => g.status === "active");
    const achieved = r.all.filter((g) => g.status === "achieved");
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Active goals" value={active.length} />
          <Stat label="Achieved" value={achieved.length} />
          <Stat label="Contributed (all time)" value={formatCents(r.contributions.reduce((s, c) => s + c.cents, 0))} />
        </div>
        {r.contributions.length > 0 && (
          <Card>
            <CardHeader title="Savings contributions by month" />
            <BarChart data={r.contributions.map((c) => ({ label: new Date(`${c.m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), values: [c.cents / 100] }))} series={[{ name: "Contributed" }]} label="Goal contributions per month" valueFormat={{ currency: true }} />
          </Card>
        )}
        <Card>
          <CardHeader title="Progress toward goals" />
          {r.all.length === 0 ? (
            <p className="text-sm text-muted">No goals yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {r.all.map((g) => {
                const p = progressOf(g);
                return (
                  <li key={g.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[15px]">
                      <Link href={`/goals/${g.id}`} className="hover:underline">
                        {g.name}
                      </Link>
                      <span className="text-sm text-muted">{p.target ? `${Math.round(p.pct)}%` : g.status}</span>
                    </div>
                    {p.target > 0 && <ProgressBar value={p.current} max={p.target} label={g.name} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    );
  }
}
