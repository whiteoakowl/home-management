import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { deletePregnancyItem, quickPregnancyLog, updatePregnancyItem } from "@/app/actions/pregnancy";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { PregnancyItemModal, PregnancyLogModal } from "@/components/pregnancy/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { BarChart } from "@/components/wellness/charts";
import { addDays, zonedToUtc } from "@/lib/dates";
import { itemsOf, logsOf } from "@/lib/pregnancy/queries";
import { PLogList } from "../../logs";
import { dateOf, PremiumLocked, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Daily care" };
const icon = "inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink";

export default async function CarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pregnancyContext(id);
  const { p, tz, today, now, can, has } = ctx;
  const weekStart = zonedToUtc(addDays(today, -6), "00:00", tz);
  const [meds, logs] = await Promise.all([itemsOf(p.id, "medication"), logsOf(p.id, ["dose", "hydration", "meal", "sleep"], { since: zonedToUtc(addDays(today, -13), "00:00", tz), limit: 400 })]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const water = days.map((d) => ({ label: d.slice(8), value: logs.filter((l) => l.kind === "hydration" && dateOf(l.startedAt, tz) === d).reduce((s, l) => s + Number(l.amount ?? 1), 0) }));
  const sleeps = logs.filter((l) => l.kind === "sleep" && l.startedAt >= weekStart);
  const avgSleep = sleeps.length ? Math.round((sleeps.reduce((s, l) => s + ((l.endedAt?.getTime() ?? 0) - l.startedAt.getTime()), 0) / sleeps.length / 3600_000) * 10) / 10 : null;
  const doses = logs.filter((l) => l.kind === "dose");
  const takenToday = new Set(doses.filter((l) => dateOf(l.startedAt, tz) === today).map((l) => String(l.data.itemId)));
  const editMeds = can("medications");

  return (
    <>
      <PregnancyHeader ctx={ctx} active="care" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Medicines & supplements" action={editMeds ? <PregnancyItemModal pregnancyId={p.id} kind="medication" triggerLabel="Add" /> : undefined} />
          {meds.length ? (
            <ul className="divide-y divide-line">
              {meds.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="text-xl" aria-hidden>
                    💊
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {m.title} {m.done && <Badge>Stopped</Badge>} {m.data.remind === true && Array.isArray(m.data.times) && m.data.times.length > 0 && <Badge tone="olive">⏰ {String(m.data.times[0])}</Badge>}
                    </p>
                    <p className="text-sm text-muted">{[m.data.dose, m.data.schedule, m.notes].filter(Boolean).map(String).join(" · ")}</p>
                  </div>
                  {editMeds && !m.done && (
                    takenToday.has(m.id) ? (
                      <span className="text-sm text-olive-700">✓ Today</span>
                    ) : (
                      <ActionButton action={quickPregnancyLog} fields={{ pregnancyId: p.id, kind: "dose", itemId: m.id }} className="h-9 rounded-lg bg-sunken px-3 text-sm ring-1 ring-line hover:bg-primary-50">
                        Mark taken
                      </ActionButton>
                    )
                  )}
                  {editMeds && (
                    <span className="flex">
                      <ActionButton action={updatePregnancyItem} fields={{ id: m.id, done: String(!m.done) }} className="h-8 rounded-lg px-2 text-xs text-muted hover:bg-sunken">
                        {m.done ? "Restart" : "Stop"}
                      </ActionButton>
                      <PregnancyItemModal pregnancyId={p.id} kind="medication" item={{ id: m.id, title: m.title, list: m.list, status: m.status, notes: m.notes, rating: m.rating, appointmentId: m.appointmentId, data: m.data }} triggerContent={<Pencil className="size-4" />} triggerClassName={icon} />
                      <DeleteButton action={deletePregnancyItem} fields={{ id: m.id }} what={m.title} className="size-8" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Keep track of what your provider has prescribed or suggested, with reminders if you like.</p>
          )}
          <p className="mt-2 text-xs text-muted">This app doesn&apos;t recommend medicines or doses. Check with your provider or pharmacist before starting or stopping anything.</p>
          {doses.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-primary-600">Dose history (2 weeks)</summary>
              <PLogList ctx={ctx} logs={doses.slice(0, 50)} empty="" canChange={editMeds} />
            </details>
          )}
        </Card>

        <Card>
          <CardHeader title="Water & meals" />
          {!has("nutrition") && <PremiumLocked f="nutrition" />}
          <BarChart title="Glasses of water, last 7 days" bars={water} max={Math.max(8, ...water.map((w) => w.value))} />
          {can("nutrition") && (
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton action={quickPregnancyLog} fields={{ pregnancyId: p.id, kind: "hydration" }} className="h-10 rounded-xl bg-primary-50 px-3 text-sm font-medium text-primary-700 ring-1 ring-primary-200">
                +1 glass 💧
              </ActionButton>
              <PregnancyLogModal pregnancyId={p.id} kind="meal" now={now} />
            </div>
          )}
          <div className="mt-3">
            <PLogList ctx={ctx} logs={logs.filter((l) => l.kind === "meal").slice(0, 10)} empty="Log meals and snacks if it helps you notice what makes you feel good." canChange={can("nutrition")} />
          </div>
          <p className="mt-2 text-xs text-muted">A record for you, not a diet. Your provider can help with any nutrition questions.</p>
        </Card>

        <Card>
          <CardHeader title="Sleep" action={can("sleep") ? <PregnancyLogModal pregnancyId={p.id} kind="sleep" now={now} triggerLabel="Log sleep" /> : undefined} />
          {!has("sleep") && <PremiumLocked f="sleep" />}
          <p className="mb-3 text-sm">{avgSleep !== null ? `About ${avgSleep} hours a night this week.` : "No sleep logged this week."}</p>
          <PLogList ctx={ctx} logs={logs.filter((l) => l.kind === "sleep").slice(0, 7)} empty="" canChange={can("sleep")} />
          <Link href="/sounds" className="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline">
            🌙 Wind down with Sleep Sounds →
          </Link>
        </Card>
      </div>
    </>
  );
}
