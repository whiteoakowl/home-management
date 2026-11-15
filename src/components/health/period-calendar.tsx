"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { savePeriodDay } from "@/app/actions/health";
import { ActionForm } from "@/components/forms/action-form";
import { ChipSelect } from "@/components/forms/fields";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export type PeriodDayView = { flow: string | null; symptoms: string[]; feelings: string[]; moodIntensity: number | null; note: string | null };
type Mark = "period" | "predicted" | "fertile" | "ovulation";

const FLOW_OPTIONS = [
  { key: "none", label: "None", dots: 0 },
  { key: "spotting", label: "Spotting", dots: 1 },
  { key: "light", label: "Light", dots: 1 },
  { key: "medium", label: "Medium", dots: 2 },
  { key: "heavy", label: "Heavy", dots: 3 },
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const isFlow = (f: string | null) => f === "light" || f === "medium" || f === "heavy";

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Month calendar: recorded days are solid, predictions are dashed/soft and labelled as estimates. */
export function PeriodCalendar({
  month,
  today,
  days,
  marks,
  memberId,
  canEdit,
  symptoms,
  feelings,
}: {
  month: string;
  today: string;
  days: Record<string, PeriodDayView>;
  marks: Record<string, Mark>;
  memberId: string;
  canEdit: boolean;
  symptoms: string[];
  feelings: string[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const first = `${month.slice(0, 7)}-01`;
  const startPad = new Date(`${first}T12:00:00Z`).getUTCDay();
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startPad + daysInMonth) / 7) * 7 }, (_, i) => (i < startPad || i >= startPad + daysInMonth ? null : addDays(first, i - startPad)));
  const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Period calendar">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const rec = days[d];
          const mark = marks[d];
          const recorded = isFlow(rec?.flow ?? null);
          const describe = [recorded ? `Period (${rec!.flow})` : rec?.flow === "spotting" ? "Spotting" : mark === "predicted" ? "Predicted period (estimate)" : mark === "fertile" ? "Estimated fertile window" : mark === "ovulation" ? "Estimated ovulation" : null, rec?.symptoms.length ? `${rec.symptoms.length} symptoms` : null, rec?.note ? "note" : null].filter(Boolean).join(", ");
          return (
            <button
              key={d}
              type="button"
              disabled={!canEdit}
              onClick={() => setOpen(d)}
              aria-label={`${label(d)}${describe ? `: ${describe}` : ""}`}
              className={cn(
                "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-sm tabular-nums transition-colors disabled:cursor-default",
                recorded && "bg-wine-500 font-semibold text-white",
                !recorded && rec?.flow === "spotting" && "bg-wine-50 text-wine-700",
                !recorded && !rec?.flow && mark === "predicted" && "border-2 border-dashed border-wine-400 text-wine-700",
                !recorded && !rec?.flow && mark === "fertile" && "bg-olive-50 text-olive-700",
                !recorded && !rec?.flow && mark === "ovulation" && "bg-olive-100 font-semibold text-olive-700 ring-2 ring-olive-500 ring-inset",
                !recorded && !rec?.flow && !mark && "hover:bg-sunken",
                d === today && "outline-2 outline-offset-1 outline-primary-500",
              )}
            >
              {Number(d.slice(8))}
              <span className="absolute bottom-1 flex gap-0.5" aria-hidden>
                {(rec?.symptoms.length || rec?.feelings.length) ? <span className={cn("size-1.5 rounded-full", recorded ? "bg-white" : "bg-primary-500")} /> : null}
                {rec?.note ? <NotebookPen className={cn("size-2.5", recorded ? "text-white" : "text-primary-600")} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-wine-500" /> Period (recorded)</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded border-2 border-dashed border-wine-400" /> Predicted period</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-olive-50 ring-1 ring-olive-400" /> Fertile window (estimate)</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-olive-100 ring-2 ring-olive-500" /> Ovulation (estimate)</li>
        <li className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary-500" /> Symptoms or feelings</li>
      </ul>
      {open && (
        <DayEditor key={open} date={open} title={label(open)} day={days[open]} memberId={memberId} symptoms={symptoms} feelings={feelings} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/** Quick day logging: flow in one tap, then optional symptoms, feelings, intensity and a note. */
export function DayEditor({
  date,
  title,
  day,
  memberId,
  symptoms,
  feelings,
  onClose,
}: {
  date: string;
  title: string;
  day?: PeriodDayView;
  memberId: string;
  symptoms: string[];
  feelings: string[];
  onClose: () => void;
}) {
  const [flow, setFlow] = useState(day?.flow ?? "");
  const [intensity, setIntensity] = useState(day?.moodIntensity ? String(day.moodIntensity) : "");
  const opt = (xs: string[], extra: string[] = []) => [...new Set([...xs, ...extra])].map((x) => ({ value: x, label: x }));
  return (
    <Modal open onClose={onClose} title={title} description="Everything here is private unless you share your Period Tracker in the Privacy Center.">
      <ActionForm action={savePeriodDay} onSuccess={onClose} submitLabel="Save day" resetOnSuccess={false}>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="memberId" value={memberId} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">Flow</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {FLOW_OPTIONS.map((o) => (
              <label key={o.key} className={cn("relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium", flow === o.key ? "border-wine-500 bg-wine-50 text-wine-700" : "border-line-strong hover:bg-sunken")}>
                <input type="radio" name="flow" value={o.key} checked={flow === o.key} onChange={() => setFlow(o.key)} className="sr-only" />
                <span className="flex gap-0.5" aria-hidden>
                  {o.dots === 0 ? <span className="size-2 rounded-full border border-line-strong" /> : Array.from({ length: o.dots }, (_, i) => <span key={i} className={cn("size-2 rounded-full", o.key === "spotting" ? "bg-wine-400" : "bg-wine-500")} />)}
                </span>
                {o.label}
              </label>
            ))}
          </div>
          {flow && (
            <button type="button" onClick={() => setFlow("")} className="mt-1.5 text-xs text-muted underline">
              Clear flow
            </button>
          )}
          {flow === "" && <input type="hidden" name="flow" value="" />}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">Symptoms</legend>
          <ChipSelect name="symptoms" options={opt(symptoms, day?.symptoms)} defaultValue={day?.symptoms ?? []} />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">Feelings</legend>
          <ChipSelect name="feelings" options={opt(feelings, day?.feelings)} defaultValue={day?.feelings ?? []} />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">How strong were the feelings? (optional)</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {[["1", "Low"], ["2", "Medium"], ["3", "High"]].map(([v, l]) => (
              <label key={v} className={cn("relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-sm", intensity === v ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}>
                <input type="radio" name="moodIntensity" value={v} checked={intensity === v} onChange={() => setIntensity(v)} onClick={() => intensity === v && setIntensity("")} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
          Notes
          <textarea name="note" rows={3} defaultValue={day?.note ?? ""} className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink focus:border-primary-500 focus:outline-none" />
        </label>
        <p className="text-xs text-muted">Add your own symptoms and feelings in the tracker&apos;s settings.</p>
      </ActionForm>
    </Modal>
  );
}
