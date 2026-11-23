import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { ContractionTimer } from "@/components/pregnancy/timers";
import { contractionStats, type Contraction } from "@/lib/pregnancy/dates";
import { logsOf } from "@/lib/pregnancy/queries";
import { URGENT_NOTE } from "@/lib/pregnancy/weeks";
import { clockOf, PregnancyHeader, pregnancyContext, whenOf } from "../../shared";
import { deletePregnancyLog } from "@/app/actions/pregnancy";
import { DeleteButton } from "@/components/forms/inline";

export const metadata: Metadata = { title: "Contraction timer" };

export default async function ContractionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pregnancyContext(id);
  const { p, tz, can } = ctx;
  const sessions = await logsOf(p.id, ["contractions"], { limit: 20 });
  return (
    <>
      <PregnancyHeader ctx={ctx} active="contractions" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ContractionTimer pregnancyId={p.id} canSave={can("contractions") && p.status === "active"} />
        </Card>
        <Card>
          <CardHeader title="Saved sessions" />
          {sessions.length ? (
            <ul className="flex flex-col gap-3">
              {sessions.map((l) => {
                const st = contractionStats((l.data.contractions as Contraction[]) ?? []);
                return (
                  <li key={l.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{whenOf(l.startedAt, tz)}</p>
                        <p className="text-sm text-muted">
                          {st.count} timed · avg {st.avgSeconds ?? "—"}s long · {st.avgInterval ?? "—"} min apart · {st.spanMinutes} min session
                        </p>
                        {l.notes && <p className="mt-1 text-sm">{l.notes}</p>}
                      </div>
                      {ctx.canEdit && <DeleteButton action={deletePregnancyLog} fields={{ id: l.id }} what="this session" className="size-8" />}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-primary-600">Timeline</summary>
                      <ol className="mt-1 text-sm tabular-nums">
                        {st.rows.map((r) => (
                          <li key={r.start} className="flex justify-between border-b border-line py-1 last:border-0">
                            <span>{clockOf(new Date(r.start), tz)}</span>
                            <span>{r.seconds}s</span>
                            <span className="text-muted">{r.interval !== null ? `${r.interval} min apart` : "first"}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Saved sessions show here with a timeline you can share with your provider.</p>
          )}
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted">This timer records times only and can&apos;t tell you whether you&apos;re in labor. Follow the instructions your provider gave you about when to call. {URGENT_NOTE}</p>
    </>
  );
}
