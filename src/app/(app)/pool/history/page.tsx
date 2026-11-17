import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical, Pencil } from "lucide-react";
import { deleteAddition, deleteTest } from "@/app/actions/pool";
import { DeleteButton } from "@/components/forms/inline";
import { AdditionModal, TestModal } from "@/components/pool/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn, utcToZoned } from "@/lib/dates";
import { READING_META, statusOf, type ReadingKey } from "@/lib/pool";
import { familyPools, poolAdditionsFor, poolTestsFor, profileOf, READING_KEYS } from "@/lib/pool-data";
import { cn, formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Pool history" };

const TONE = { ok: "text-emerald-700 dark:text-emerald-300", "watch-low": "text-amber-700 dark:text-amber-300", "watch-high": "text-amber-700 dark:text-amber-300", low: "font-semibold text-red-700 dark:text-red-300", high: "font-semibold text-red-700 dark:text-red-300" } as const;

export default async function PoolHistoryPage({ searchParams }: PageProps<"/pool/history">) {
  const viewer = await getViewer();
  if (!viewer.can("pool")) notFound();
  const sp = await searchParams;
  const all = await familyPools(viewer);
  const pool = all.find((p) => p.id === sp.pool) ?? all[0];
  if (!pool) notFound();
  const prof = profileOf(pool);
  const tz = viewer.family.timezone;
  const today = todayIn(tz);
  const [tests, additions] = await Promise.all([poolTestsFor(viewer, pool.id, 500), poolAdditionsFor(viewer, pool.id, 500)]);
  const keys = READING_KEYS.filter((k) => (k === "salt" ? pool.sanitizer === "salt" : pool.sanitizer === "bromine" ? k !== "cc" && k !== "cya" : true));
  const canEdit = viewer.can("pool", "edit");
  const mine = (id: string | null) => canEdit || id === viewer.member.id;
  const fmt = (k: ReadingKey, v: number) => (k === "ph" ? v.toFixed(1) : Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <>
      <Link href={`/pool?pool=${pool.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {pool.name}
      </Link>
      <PageHeader eyebrow="Pool" title="History" description={`Every water test and chemical for ${pool.name}. Red is out of range, amber is a little off.`} />

      <Card className="mb-6 p-0 sm:p-0">
        <div className="p-5 pb-0">
          <CardHeader title={`Water tests (${tests.length})`} />
        </div>
        {tests.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-5 py-2 font-medium">Date</th>
                  {keys.map((k) => (
                    <th key={k} className="px-2 py-2 text-right font-medium">
                      {k === "fc" && pool.sanitizer === "bromine" ? "Br" : READING_META[k].short}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium">By</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {tests.map(({ t, by }) => {
                  const z = utcToZoned(t.testedAt, tz);
                  return (
                    <tr key={t.id} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-2 whitespace-nowrap">
                        {formatShortDate(z.date)}
                        {t.notes && <span className="block max-w-48 truncate text-xs text-muted" title={t.notes}>{t.notes}</span>}
                      </td>
                      {keys.map((k) => {
                        const v = t[k];
                        const st = v != null ? statusOf(prof, k, { ...t, [k]: v }) : null;
                        return (
                          <td key={k} className={cn("px-2 py-2 text-right tabular-nums", st && TONE[st])}>
                            {v != null ? fmt(k, v) : <span className="text-muted">·</span>}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-xs text-muted">{by ?? ""}</td>
                      <td className="py-1 pr-3 text-right whitespace-nowrap">
                        {mine(t.testedByMemberId) && (
                          <>
                            <TestModal
                              poolId={pool.id}
                              sanitizer={pool.sanitizer}
                              today={today}
                              test={{ id: t.id, date: z.date, notes: t.notes, fc: t.fc, cc: t.cc, ph: t.ph, ta: t.ta, ch: t.ch, cya: t.cya, salt: t.salt, tempF: t.tempF, phosphates: t.phosphates }}
                              triggerContent={<Pencil className="mx-auto size-4" />}
                            />
                            <DeleteButton action={deleteTest} fields={{ id: t.id }} what="this test" className="size-8" />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState compact icon={<FlaskConical />} title="No tests yet" description="Logged tests show here, colour-coded against the ideal ranges." />
          </div>
        )}
      </Card>

      <Card id="chemicals" className="p-0 sm:p-0">
        <div className="p-5 pb-0">
          <CardHeader title={`Chemicals added (${additions.length})`} />
        </div>
        {additions.length ? (
          <ul className="divide-y divide-line">
            {additions.map(({ a, by }) => (
              <li key={a.id} className="flex items-center gap-2 px-5 py-2.5 text-[15px]">
                <span className="w-20 shrink-0 text-sm text-muted">{formatShortDate(a.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{a.chemical}</span>
                  {a.amount && <span className="text-muted"> · {a.amount}</span>}
                  {a.notes && <span className="block text-xs text-muted">{a.notes}</span>}
                </span>
                {a.costCents ? <span className="text-sm tabular-nums">{formatCents(a.costCents)}</span> : null}
                <span className="hidden text-xs text-muted sm:inline">{by ?? ""}</span>
                {mine(a.addedByMemberId) && (
                  <>
                    <AdditionModal poolId={pool.id} today={today} canBudget={false} defaults={{ id: a.id, chemical: a.chemical, amount: a.amount, date: a.date, cost: a.costCents ? a.costCents / 100 : null, notes: a.notes }} triggerContent={<Pencil className="mx-auto size-4" />} />
                    <DeleteButton action={deleteAddition} fields={{ id: a.id }} what={`this ${a.chemical} entry`} className="size-8" />
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState compact icon={<FlaskConical />} title="Nothing logged" description="Chemicals you add show here with amounts and costs." />
          </div>
        )}
      </Card>
    </>
  );
}
