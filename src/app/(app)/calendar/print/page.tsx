import type { Metadata } from "next";
import Link from "next/link";
import { faithPathsOf } from "@/lib/faith-config";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { AutoPrint } from "@/components/meals/week-controls";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { getCalendarItems, LAYERS, type CalendarItem, type Layer } from "@/lib/calendar";
import { memberColor } from "@/lib/colors";
import { getViewer } from "@/lib/dal";
import { addDays, daysBetween, monthLabel, startOfMonth, startOfWeek, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Print calendar" };

const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "a" : "p"}`;
};
const when = (i: CalendarItem) => (i.startMin === null ? "" : `${fmtMin(i.startMin)}${i.endMin ? `–${fmtMin(i.endMin)}` : ""}`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
const byTime = (a: CalendarItem, b: CalendarItem) => (a.startMin ?? -1) - (b.startMin ?? -1) || a.title.localeCompare(b.title);

/**
 * Printable family calendar (Print, or Save as PDF from the print dialog):
 * the same view, dates, person and categories as the calendar screen, under
 * a family header.
 */
export default async function PrintCalendarPage({ searchParams }: PageProps<"/calendar/print">) {
  const viewer = await getViewer();
  if (!viewer.can("calendar")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const ws = viewer.family.settings?.weekStartsOn ?? 0;
  const view = sp.view === "week" || sp.view === "day" || sp.view === "list" ? sp.view : "month";
  const date = iso(sp.date) ?? today;
  const members = await memberOptions(viewer);
  const member = typeof sp.member === "string" && members.some((m) => m.id === sp.member) ? sp.member : "";
  const saved = viewer.member.calendarLayers;
  const layers = (typeof sp.layers === "string" && sp.layers ? sp.layers.split(",") : (saved ?? ["events", "plans", "chores", "workouts", "dance", "sports", "work", "vehicles", "synced", ...faithPathsOf(viewer.member, viewer.family).filter((f) => f !== "spiritual")])).filter((l): l is Layer => (LAYERS as readonly string[]).includes(l));
  const hidden = new Set(typeof sp.hide === "string" ? sp.hide.split(",").filter(Boolean) : (viewer.member.calendarHiddenCategories ?? []));

  const range = (() => {
    if (view === "month") {
      const from = startOfWeek(startOfMonth(date), ws);
      return { from, to: addDays(from, 41) };
    }
    if (view === "week") {
      const from = startOfWeek(date, ws);
      return { from, to: addDays(from, 6) };
    }
    if (view === "day") return { from: date, to: date };
    const from = iso(sp.from) ?? today;
    let to = iso(sp.to) ?? addDays(from, 30);
    if (to < from) to = from;
    if (daysBetween(from, to) > 366) to = addDays(from, 366);
    return { from, to };
  })();

  const all = await getCalendarItems(viewer, range.from, range.to, { layers, memberId: member || null });
  const visible = hidden.size ? all.filter((i) => i.layer !== "events" || !hidden.has(i.categoryId ?? "none")) : all;
  // The List view's extra filters.
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const needle = s("q").trim().toLowerCase();
  const typeOf = (i: CalendarItem) => (i.layer === "events" ? (i.type ?? "event") : i.layer);
  const items = (view !== "list"
    ? visible
    : visible.filter(
        (i) =>
          (!s("category") || i.categoryId === s("category")) &&
          (!s("type") || typeOf(i) === s("type")) &&
          (!s("vis") || (i.visibility ?? "family") === s("vis")) &&
          (!s("color") || i.color === s("color")) &&
          (!needle || [i.title, i.location, i.category, i.description].some((x) => x?.toLowerCase().includes(needle))),
      )
  ).sort(byTime);
  const on = (d: string) => items.filter((i) => i.date === d);
  const who = (i: CalendarItem) =>
    i.people
      .map((id) => members.find((m) => m.id === id)?.displayName.split(" ")[0])
      .filter(Boolean)
      .join(", ");
  const person = members.find((m) => m.id === member);

  // Month view: trim the 6th week when the month doesn't reach it.
  const month = date.slice(0, 7);
  const weeks = view === "month" ? Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(range.from, w * 7 + d))).filter((wk) => wk.some((d) => d.startsWith(month))) : [];
  const weekDays = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(range.from, i)) : [];
  const listDays = view === "day" || view === "list" ? [...new Set(items.map((i) => i.date))].sort() : [];

  const subtitle =
    view === "month"
      ? monthLabel(date)
      : view === "day"
        ? fmt(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : `${fmt(range.from, { month: "long", day: "numeric" })} – ${fmt(range.to, { month: "long", day: "numeric", year: "numeric" })}`;
  const auto = sp.auto === "print" || sp.auto === "pdf" ? sp.auto : null;
  const back = `/calendar?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && !["auto", "from", "to"].includes(e[0])))}`;
  const accent = memberColor(viewer.family.theme?.accent ?? "plum").solid;
  const dot = (i: CalendarItem) => <span className="mt-[5px] size-2 shrink-0 rounded-full [print-color-adjust:exact]" style={{ background: memberColor(i.color).solid }} aria-hidden />;
  const wide = view === "month" || view === "week";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Month and week fit best sideways on the page. */}
      <style>{`@media print { @page { size: ${wide ? "landscape" : "portrait"}; margin: 10mm; } main { padding: 0 !important; } }`}</style>
      <AutoPrint when={!!auto} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to calendar
        </Link>
        <PrintButton label={auto === "pdf" ? "Save as PDF" : "Print"} />
      </div>
      {auto === "pdf" && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 print:hidden">
          <FileDown className="size-4 shrink-0" /> To save a PDF, choose “Save as PDF” as the printer (on iPhone, tap Share → Save to Files).
        </p>
      )}

      <article className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-[#2b1f2a] print:border-0 print:p-0">
        {/* Family header */}
        <header className="mb-4 flex items-center gap-4 border-b-4 pb-3 [print-color-adjust:exact]" style={{ borderColor: accent }}>
          <BrandMark className="size-12 [print-color-adjust:exact]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: accent }}>
              The {viewer.family.name} Family
            </p>
            <h1 className="font-display text-[28px] leading-tight font-semibold">
              {person ? `${person.displayName.split(" ")[0]}'s Calendar` : "Family Calendar"} · {subtitle}
            </h1>
          </div>
          {!person && (
            <ul className="hidden flex-wrap justify-end gap-x-3 gap-y-1 text-xs sm:flex print:flex">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full [print-color-adjust:exact]" style={{ background: memberColor(m.color).solid }} />
                  {m.displayName.split(" ")[0]}
                </li>
              ))}
            </ul>
          )}
        </header>

        {view === "month" && (
          <table className="w-full table-fixed border-collapse text-[11px] leading-tight print:text-[9.5px]">
            <thead>
              <tr>
                {weeks[0]!.map((d) => (
                  <th key={d} className="border border-[#d8cfd6] bg-[#f4eef2] p-1 text-center font-semibold [print-color-adjust:exact]">
                    {WD[new Date(`${d}T12:00:00Z`).getUTCDay()]!.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((wk) => (
                <tr key={wk[0]} className="break-inside-avoid">
                  {wk.map((d) => (
                    <td key={d} className={cn("h-24 border border-[#d8cfd6] p-1 align-top", weeks.length > 5 ? "print:h-[21mm]" : "print:h-[25mm]", !d.startsWith(month) && "bg-[#faf7f9] text-[#9a8f98] [print-color-adjust:exact]")}>
                      <p className={cn("mb-0.5 text-right text-xs font-semibold", d === today && "underline")}>{Number(d.slice(8))}</p>
                      <ul className="flex flex-col gap-0.5">
                        {on(d).map((i) => (
                          <li key={i.key} className="flex gap-1">
                            {dot(i)}
                            <span className={cn("min-w-0", i.done && "line-through opacity-60")}>
                              {i.startMin !== null && <span className="font-semibold tabular-nums">{fmtMin(i.startMin)} </span>}
                              {i.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "week" && (
          <table className="w-full table-fixed border-collapse text-xs leading-snug">
            <thead>
              <tr>
                {weekDays.map((d) => (
                  <th key={d} className="border border-[#d8cfd6] bg-[#f4eef2] p-1.5 text-left font-semibold [print-color-adjust:exact]">
                    {WD[new Date(`${d}T12:00:00Z`).getUTCDay()]!.slice(0, 3)} <span className="font-normal">{fmt(d, { month: "short", day: "numeric" })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDays.map((d) => (
                  <td key={d} className="h-[60vh] border border-[#d8cfd6] p-1.5 align-top print:h-[128mm]">
                    <ul className="flex flex-col gap-1.5">
                      {on(d).map((i) => (
                        <li key={i.key} className="flex gap-1">
                          {dot(i)}
                          <span className={cn("min-w-0", i.done && "line-through opacity-60")}>
                            {when(i) && <span className="block font-semibold tabular-nums">{when(i)}</span>}
                            {i.title}
                            {i.location && <span className="block text-[10px] text-[#7a6f78]">{i.location}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}

        {(view === "day" || view === "list") &&
          (listDays.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#7a6f78]">Nothing scheduled.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {listDays.map((d) => (
                <section key={d} className="break-inside-avoid">
                  <h2 className="mb-1 border-b border-[#d8cfd6] pb-1 text-sm font-semibold">{fmt(d, { weekday: "long", month: "long", day: "numeric" })}</h2>
                  <table className="w-full text-sm">
                    <tbody>
                      {on(d).map((i) => (
                        <tr key={i.key} className="align-top">
                          <td className="w-28 py-1 pr-3 font-semibold whitespace-nowrap tabular-nums">{when(i) || "All day"}</td>
                          <td className="py-1">
                            <span className="flex gap-2">
                              {dot(i)}
                              <span className={cn(i.done && "line-through opacity-60")}>
                                {i.title}
                                {i.location && <span className="text-[#7a6f78]"> · {i.location}</span>}
                              </span>
                            </span>
                          </td>
                          <td className="w-40 py-1 text-right text-xs text-[#7a6f78]">{who(i)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          ))}

        <footer className="mt-4 flex justify-between text-[10px] text-[#9a8f98]">
          <span>The {viewer.family.name} Family</span>
          <span>Printed {fmt(today, { month: "long", day: "numeric", year: "numeric" })}</span>
        </footer>
      </article>
    </div>
  );
}
