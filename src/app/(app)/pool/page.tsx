import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Droplets, FlaskConical, History, ListChecks, Scale, Snowflake, Trash2, Waves, Wrench } from "lucide-react";
import { deleteAddition, deleteEquipment, deletePool, markServiced, setupPoolRoutine } from "@/app/actions/pool";
import { LineChart } from "@/components/charts";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { AdditionModal, EquipmentModal, PoolModal, TestModal } from "@/components/pool/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { listOccurrences } from "@/lib/chores";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { adviceFor, CHLORINE_PRODUCTS, chlorineTargets, lsi, rangeFor, READING_META, statusOf, type ReadingKey, type Status } from "@/lib/pool";
import { currentWater, familyPools, poolAdditionsFor, poolEquipmentFor, poolTestsFor, profileOf, READING_KEYS } from "@/lib/pool-data";
import { memberOptions } from "@/lib/queries";
import { cn, formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Pool" };

const STATUS_STYLE: Record<Status, { cls: string; label: string }> = {
  ok: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800", label: "Ideal" },
  "watch-low": { cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800", label: "A bit low" },
  "watch-high": { cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800", label: "A bit high" },
  low: { cls: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800", label: "Low" },
  high: { cls: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800", label: "High" },
};

const ago = (d: Date, now: Date) => {
  const days = Math.floor((now.getTime() - d.getTime()) / 86400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

export default async function PoolPage({ searchParams }: PageProps<"/pool">) {
  const viewer = await getViewer();
  if (!viewer.can("pool")) notFound();
  const sp = await searchParams;
  const all = await familyPools(viewer);
  const canEdit = viewer.can("pool", "edit");
  const canUse = viewer.can("pool", "use");
  const today = todayIn(viewer.family.timezone);

  if (!all.length) {
    return (
      <>
        <PageHeader help="pool" eyebrow="Household" title="Pool" description="Water tests, exactly what to add, maintenance and equipment for your pool or spa." actions={canEdit ? <PoolModal defaultOpen={sp.new === "1"} /> : undefined} />
        <Card>
          <EmptyState
            icon={<Waves />}
            title="Add your pool or spa"
            description="Enter its size and sanitizer once. Then log a water test and we'll show what's in range and exactly how much of each chemical to add."
            example="Backyard pool · 15,000 gal · saltwater · plaster"
            action={canEdit ? <PoolModal /> : undefined}
          />
        </Card>
      </>
    );
  }

  const pool = all.find((p) => p.id === sp.pool) ?? all[0]!;
  const prof = profileOf(pool);
  const [tests, additions, equipment, members, routine] = await Promise.all([
    poolTestsFor(viewer, pool.id, 60),
    poolAdditionsFor(viewer, pool.id, 8),
    poolEquipmentFor(viewer, pool.id),
    memberOptions(viewer),
    listOccurrences(viewer, { kinds: ["chore", "task", "maintenance"], poolId: pool.id, to: addDays(today, 7), statuses: ["pending"], limit: 12 }),
  ]);
  const now = new Date();
  const { reading, when, lastTested } = currentWater(tests, now);
  const advice = adviceFor(prof, reading);
  const balance = lsi(prof, reading);
  const targets = chlorineTargets(prof, reading.cya);
  const shown = READING_KEYS.filter((k) => (k === "salt" ? pool.sanitizer === "salt" : pool.sanitizer === "bromine" ? k !== "cc" && k !== "cya" : true));
  const canBudget = viewer.can("budget", "edit");
  const chartTests = [...tests].reverse().slice(-30);
  const fmtVal = (k: ReadingKey, v: number) => (k === "ph" ? v.toFixed(1) : Number.isInteger(v) ? String(v) : v.toFixed(1));
  const q = `?pool=${pool.id}`;

  return (
    <>
      <PageHeader
        eyebrow="Household"
        title={all.length > 1 ? pool.name : "Pool"}
        description={`${pool.kind === "spa" ? "Spa" : "Pool"} · ${pool.gallons.toLocaleString()} gal · ${pool.sanitizer === "salt" ? "saltwater" : pool.sanitizer} · ${pool.surface}`}
        actions={
          <>
            {canUse && <TestModal poolId={pool.id} sanitizer={pool.sanitizer} today={today} defaultOpen={sp.new === "test"} triggerContent={undefined} />}
            {canUse && <AdditionModal poolId={pool.id} today={today} canBudget={canBudget} />}
            {canEdit && (
              <PoolModal
                pool={{ id: pool.id, name: pool.name, kind: pool.kind, gallons: pool.gallons, sanitizer: pool.sanitizer, surface: pool.surface, chlorineProduct: pool.chlorineProduct, saltTarget: pool.saltTarget, filterType: pool.filterType, isOpen: pool.isOpen, notes: pool.notes }}
              />
            )}
          </>
        }
      />
      {all.length > 1 && (
        <div className="mb-5">
          <SegmentLinks fit active={pool.id} items={all.map((p) => ({ key: p.id, href: `/pool?pool=${p.id}`, label: p.name }))} />
        </div>
      )}
      {!pool.isOpen && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          <Snowflake className="size-4" aria-hidden /> Closed for the season. Test every few weeks to keep the water from going green under the cover.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Water now" icon={<Droplets className="size-4" />} href={`/pool/history${q}`} hrefLabel="History" />
            {lastTested ? (
              <>
                <p className="-mt-2 mb-3 text-sm text-muted">
                  Last tested {ago(lastTested, now)}. Free chlorine target {targets.min}–{targets.max} ppm{pool.sanitizer !== "bromine" && reading.cya != null ? ` for CYA ${reading.cya}` : ""}.
                </p>
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {shown.map((k) => {
                    const v = reading[k];
                    const st = statusOf(prof, k, reading);
                    const r = rangeFor(prof, k, reading);
                    const m = READING_META[k];
                    const label = k === "fc" && pool.sanitizer === "bromine" ? "Bromine" : m.label;
                    return (
                      <li key={k} className={cn("flex flex-col rounded-2xl p-3 ring-1", st ? STATUS_STYLE[st].cls : "bg-sunken/60 text-ink ring-line")}>
                        <span className="text-xs font-semibold tracking-wide uppercase opacity-80">{label}</span>
                        <span className="font-display text-2xl font-semibold tabular-nums">
                          {v != null ? fmtVal(k, v) : "—"}
                          {v != null && m.unit && <span className="ml-1 text-sm font-normal">{m.unit}</span>}
                        </span>
                        <span className="text-xs">
                          {st ? STATUS_STYLE[st].label : v == null ? "Not tested" : ""}
                          {r ? ` · ideal ${fmtVal(k, r.ideal[0])}–${fmtVal(k, r.ideal[1])}` : ""}
                        </span>
                        {when[k] && when[k]!.getTime() < now.getTime() - 3 * 86400_000 && <span className="text-[11px] opacity-70">from {ago(when[k]!, now)}</span>}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <EmptyState compact icon={<FlaskConical />} title="No tests yet" description="Log your first water test. Any readings you have help: free chlorine and pH are the most important." action={canUse ? <TestModal poolId={pool.id} sanitizer={pool.sanitizer} today={today} /> : undefined} />
            )}
          </Card>

          <Card>
            <CardHeader title="What to add" icon={<FlaskConical className="size-4" />} />
            {!lastTested ? (
              <p className="text-sm text-muted">Log a test to see exactly what to add.</p>
            ) : advice.length === 0 ? (
              <p className="flex items-center gap-2 text-[15px] text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-5" aria-hidden /> Everything you tested is in range. Nothing to add.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {advice.map((a, i) => (
                  <li key={i} className={cn("rounded-2xl border p-3", a.severity === "act" ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30")}>
                    <p className="text-[15px] font-medium">{a.title}</p>
                    {a.product && (
                      <p className="mt-1.5 text-[15px]">
                        Add <strong className="font-semibold">{a.amount}</strong> of {a.product.toLowerCase()}
                      </p>
                    )}
                    {a.note && <p className="mt-1 text-sm text-muted">{a.note}</p>}
                    {a.product && canUse && (
                      <div className="mt-2">
                        <AdditionModal poolId={pool.id} today={today} canBudget={canBudget} label="I added this" triggerVariant="soft" defaults={{ chemical: a.product, amount: a.amount }} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-muted">
              Amounts are for {pool.gallons.toLocaleString()} gallons using {CHLORINE_PRODUCTS[pool.chlorineProduct].label.toLowerCase()} for chlorine. Always follow the product label, add one chemical at a time with the pump running, and retest.
            </p>
          </Card>

          {chartTests.filter((t) => t.t.fc != null).length > 1 && (
            <Card>
              <CardHeader title={`${pool.sanitizer === "bromine" ? "Bromine" : "Free chlorine"} trend`} />
              <LineChart data={chartTests.filter((t) => t.t.fc != null).map((t) => ({ label: formatShortDate(t.t.testedAt.toISOString().slice(0, 10)), value: t.t.fc! }))} label="Free chlorine over time" seriesName="ppm" height={180} />
            </Card>
          )}
          {chartTests.filter((t) => t.t.ph != null).length > 1 && (
            <Card>
              <CardHeader title="pH trend" />
              <LineChart data={chartTests.filter((t) => t.t.ph != null).map((t) => ({ label: formatShortDate(t.t.testedAt.toISOString().slice(0, 10)), value: t.t.ph! }))} label="pH over time" seriesName="pH" height={180} />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Water balance" icon={<Scale className="size-4" />} />
            {balance ? (
              <div className="flex flex-col gap-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold tabular-nums">{balance.value > 0 ? "+" : ""}{balance.value.toFixed(2)}</span>
                  <Badge tone={balance.verdict === "balanced" ? "olive" : "wine"}>{balance.verdict === "balanced" ? "Balanced" : balance.verdict === "corrosive" ? "Corrosive" : "Scale-forming"}</Badge>
                </p>
                <p className="text-sm text-muted">
                  {balance.verdict === "balanced"
                    ? "Saturation index between −0.3 and +0.3: gentle on surfaces and equipment."
                    : balance.verdict === "corrosive"
                      ? "Water may etch plaster and corrode metal. Raise pH, alkalinity or calcium (see What to add)."
                      : "Water may leave scale on tile and in the heater or salt cell. Lower pH or alkalinity."}
                  {balance.estimatedTemp ? " Water temperature not tested; estimated." : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">Test pH, alkalinity and calcium hardness to see the saturation index (LSI).</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Routine" icon={<ListChecks className="size-4" />} href="/house/chores?tab=all" hrefLabel="All chores" />
            {routine.length ? (
              <OccurrenceList items={routine} today={today} members={members} canManage={viewer.can("chores", "edit")} showAssignee />
            ) : canEdit && viewer.can("chores", "edit") ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">Set up the recommended {pool.kind === "spa" ? "spa" : "pool"} routine: testing, skimming, brushing, vacuuming and filter care. They become chores you can assign, and they earn points.</p>
                <ActionButton action={setupPoolRoutine} fields={{ poolId: pool.id }} className="h-10 w-fit rounded-[var(--radius-control)] bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">
                  <ListChecks className="size-4" /> Set up routine
                </ActionButton>
              </div>
            ) : (
              <p className="text-sm text-muted">Nothing due this week.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Chemicals added" icon={<History className="size-4" />} href={`/pool/history${q}#chemicals`} hrefLabel="All" />
            {additions.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {additions.map(({ a, by }) => (
                  <li key={a.id} className="flex items-center gap-2 py-2 text-[15px]">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{a.chemical}</span>
                      {a.amount && <span className="text-muted"> · {a.amount}</span>}
                      <span className="block text-xs text-muted">
                        {formatShortDate(a.date)}
                        {by ? ` · ${by}` : ""}
                        {a.costCents ? ` · ${formatCents(a.costCents)}` : ""}
                      </span>
                    </span>
                    {(canEdit || a.addedByMemberId === viewer.member.id) && <DeleteButton action={deleteAddition} fields={{ id: a.id }} what={`this ${a.chemical} entry`} className="size-8" />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Log what you add so you can see what worked.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Equipment" icon={<Wrench className="size-4" />} action={canEdit ? <EquipmentModal poolId={pool.id} /> : undefined} />
            {equipment.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {equipment.map((e) => {
                  const due = e.serviceEveryMonths && e.lastServicedOn ? addDays(e.lastServicedOn, Math.round(e.serviceEveryMonths * 30.4)) : null;
                  const overdue = due && due <= today;
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-2 text-[15px]">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{e.name}</span>
                        {e.model && <span className="text-muted"> · {e.model}</span>}
                        <span className="block text-xs text-muted">
                          {e.lastServicedOn ? `Serviced ${formatShortDate(e.lastServicedOn)}` : "No service date"}
                          {due ? ` · next ${formatShortDate(due)}` : ""}
                        </span>
                      </span>
                      {overdue && <Badge tone="wine">Service due</Badge>}
                      {canEdit && (
                        <>
                          <ActionButton action={markServiced} fields={{ id: e.id }} label={`Mark ${e.name} serviced today`} className="h-8 rounded-full px-2 text-xs font-medium text-primary-700 hover:bg-primary-50">
                            Serviced
                          </ActionButton>
                          <EquipmentModal poolId={pool.id} item={{ id: e.id, name: e.name, kind: e.kind, model: e.model, installedOn: e.installedOn, lastServicedOn: e.lastServicedOn, serviceEveryMonths: e.serviceEveryMonths, notes: e.notes }} />
                          <DeleteButton action={deleteEquipment} fields={{ id: e.id }} what={e.name} className="size-8" />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">Add the pump, filter, heater or salt cell to keep track of service.</p>
            )}
          </Card>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <PoolModal trigger="add" />
              <ActionButton action={deletePool} fields={{ id: pool.id }} confirm={`Delete ${pool.name} and all its tests and history?`} className="h-9 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
                <Trash2 className="size-4" /> Delete {pool.kind}
              </ActionButton>
              <Link href={`/pool/history${q}`} className="font-medium text-primary-700 hover:underline">
                Full history
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
