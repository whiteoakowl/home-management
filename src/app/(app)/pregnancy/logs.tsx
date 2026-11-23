import { Pencil } from "lucide-react";
import { deletePregnancyLog } from "@/app/actions/pregnancy";
import { DeleteButton } from "@/components/forms/inline";
import { PregnancyLogModal, type PLogKind } from "@/components/pregnancy/forms";
import { Badge } from "@/components/ui/display";
import { utcToZoned } from "@/lib/dates";
import { CALL_PROVIDER, MEASURES, SEVERITY } from "@/lib/pregnancy/catalog";
import type { PLog } from "@/lib/pregnancy/queries";
import { whenOf, type PCtx } from "./shared";

const EMOJI: Record<string, string> = { symptom: "🤒", mood: "😊", weight: "⚖️", measure: "🩺", hydration: "💧", meal: "🍽️", sleep: "😴", dose: "💊", kicks: "👣", contractions: "⏱️" };
const MOODS = ["", "Low", "Meh", "OK", "Good", "Great"];
const mins = (l: PLog) => (l.endedAt ? Math.round((l.endedAt.getTime() - l.startedAt.getTime()) / 60_000) : null);
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`);

/** One line describing a log (no interpretation of readings). */
export function logSummary(l: PLog) {
  const d = l.data;
  switch (l.kind) {
    case "symptom":
      return [String(d.symptom ?? "Symptom"), SEVERITY.find((s) => s.value === Number(d.severity))?.label, mins(l) ? hm(mins(l)!) : null].filter(Boolean).join(" · ");
    case "mood":
      return [d.mood && `Mood: ${MOODS[Number(d.mood)]}`, d.energy && `Energy ${d.energy}/5`, d.stress && `Stress ${d.stress}/5`, d.sleepQuality && `Sleep ${d.sleepQuality}/5`].filter(Boolean).join(" · ");
    case "weight":
      return `${Number(l.amount)} ${String(d.unit ?? "lb")}`;
    case "measure":
      return d.type === "bp" ? `Blood pressure ${d.systolic}/${d.diastolic}${d.pulse ? ` · pulse ${d.pulse}` : ""}` : `${d.type === "other" ? String(d.label ?? "Reading") : MEASURES.find((m) => m.value === d.type)?.label}: ${Number(l.amount)} ${String(d.unit ?? "")}`.trim();
    case "hydration":
      return `${Number(l.amount ?? 1)} glass${Number(l.amount) === 1 ? "" : "es"} of water`;
    case "meal":
      return `${String(d.type ?? "Meal").replace(/^./, (c) => c.toUpperCase())}: ${String(d.what ?? "")}`;
    case "sleep":
      return `Slept ${hm(mins(l) ?? 0)}${d.quality ? ` · ${["", "very poorly", "poorly", "OK", "well", "very well"][Number(d.quality)]}` : ""}${d.wakeUps ? ` · woke ${d.wakeUps}×` : ""}`;
    case "dose":
      return `Took ${String(d.name ?? "medicine")}`;
    case "kicks":
      return `${l.amount} movements in ${hm(Math.max(1, mins(l) ?? 0))}`;
    case "contractions":
      return `${l.amount} contractions over ${hm(Math.max(1, mins(l) ?? 0))}`;
  }
}

const EDITABLE = new Set(["symptom", "mood", "weight", "measure", "hydration", "meal", "sleep"]);

export function PLogList({ ctx, logs, empty, canChange }: { ctx: PCtx; logs: PLog[]; empty: string; canChange: boolean }) {
  const { p, tz, now } = ctx;
  if (!logs.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {logs.map((l) => {
        const s = utcToZoned(l.startedAt, tz);
        const e = l.endedAt ? utcToZoned(l.endedAt, tz) : null;
        const flag = l.kind === "symptom" && (Number(l.data.severity) >= 4 || CALL_PROVIDER.test(String(l.data.symptom ?? "")));
        return (
          <li key={l.id} className="flex items-center gap-3 py-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-xl" aria-hidden>
              {EMOJI[l.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {logSummary(l)} {flag && <Badge tone="wine">Talk to your provider</Badge>}
              </p>
              <p className="text-sm text-muted">{[whenOf(l.kind === "sleep" && l.endedAt ? l.endedAt : l.startedAt, tz), l.notes].filter(Boolean).join(" · ")}</p>
            </div>
            {canChange && (
              <span className="flex shrink-0 items-center">
                {EDITABLE.has(l.kind) && (
                  <PregnancyLogModal
                    pregnancyId={p.id}
                    kind={l.kind as PLogKind}
                    now={now}
                    item={{ id: l.id, date: l.kind === "sleep" && e ? e.date : s.date, time: s.time, amount: l.amount, minutes: mins(l), endTime: e?.time ?? null, data: l.kind === "sleep" ? { ...l.data, bed: s.time } : l.data, notes: l.notes }}
                    triggerContent={<Pencil className="size-4" />}
                    triggerClassName="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
                  />
                )}
                <DeleteButton action={deletePregnancyLog} fields={{ id: l.id }} what="this entry" className="size-8" />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Start of a range for the trend views. */
export function rangeStart(range: string, today: string, tz: string, p: { dueDate: string | null }, zonedToUtc: (d: string, t: string, tz: string) => Date, addDays: (d: string, n: number) => string, trimesterFrom?: number) {
  if (range === "month") return zonedToUtc(addDays(today, -29), "00:00", tz);
  if (range === "trimester" && p.dueDate && trimesterFrom) return zonedToUtc(addDays(p.dueDate, -280 + (trimesterFrom - 1) * 7), "00:00", tz);
  if (range === "all") return undefined;
  return zonedToUtc(addDays(today, -6), "00:00", tz);
}
