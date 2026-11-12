import Link from "next/link";
import { Check, Repeat } from "lucide-react";
import type { CalendarItem } from "@/lib/calendar";
import { memberColor } from "@/lib/colors";
import { addDays, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
};
const colorOf = (c: string) => memberColor(c);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Chip({ item, compact }: { item: CalendarItem; compact?: boolean }) {
  const c = colorOf(item.color);
  return (
    <Link
      href={item.href}
      title={item.title}
      className={cn("flex items-center gap-1 truncate rounded-md px-1.5 text-xs font-medium hover:brightness-95", compact ? "py-0.5" : "py-1", item.done && "line-through opacity-60")}
      style={{ background: c.soft, color: c.ink }}
    >
      {item.layer === "chores" && <Check className="size-3 shrink-0" aria-hidden />}
      {item.startMin !== null && <span className="shrink-0 tabular-nums opacity-75">{fmtMin(item.startMin)}</span>}
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

export function MonthView({ month, items, today, weekStartsOn, dayHref }: { month: string; items: CalendarItem[]; today: string; weekStartsOn: 0 | 1; dayHref: (d: string) => string }) {
  const first = `${month.slice(0, 7)}-01`;
  const wd = new Date(`${first}T12:00:00Z`).getUTCDay();
  const start = addDays(first, -((wd - weekStartsOn + 7) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = Map.groupBy(items, (i) => i.date);
  const headers = Array.from({ length: 7 }, (_, i) => WD[(i + weekStartsOn) % 7]);
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line bg-sunken/50">
        {headers.map((h) => (
          <div key={h} className="py-2 text-center text-xs font-semibold tracking-wide text-muted uppercase">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          return (
            <div key={d} className={cn("min-h-20 border-r border-b border-line p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-sunken/40")}>
              <Link
                href={dayHref(d)}
                className={cn(
                  "mb-1 inline-flex size-7 items-center justify-center rounded-full text-sm",
                  d === today ? "bg-primary-600 font-semibold text-white" : inMonth ? "text-ink hover:bg-sunken" : "text-muted",
                )}
              >
                {Number(d.slice(8))}
              </Link>
              {/* Phones: coloured dots. Larger screens: chips. */}
              <div className="flex flex-wrap gap-1 sm:hidden">
                {list.slice(0, 4).map((i) => (
                  <span key={i.key} className="size-1.5 rounded-full" style={{ background: colorOf(i.color).solid }} />
                ))}
              </div>
              <div className="hidden flex-col gap-0.5 sm:flex">
                {list.slice(0, 3).map((i) => (
                  <Chip key={i.key} item={i} compact />
                ))}
                {list.length > 3 && (
                  <Link href={dayHref(d)} className="px-1.5 text-xs font-medium text-muted hover:text-ink">
                    +{list.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DAY_START = 6 * 60;
const DAY_END = 22 * 60;
const HOUR_PX = 48;

/** Time grid for week & day views (6am–10pm, earlier/later events pinned to the edges). */
export function TimeGridView({ days, items, today, dayHref }: { days: string[]; items: CalendarItem[]; today: string; dayHref: (d: string) => string }) {
  const byDay = Map.groupBy(items, (i) => i.date);
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
  const height = ((DAY_END - DAY_START) / 60) * HOUR_PX;
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="min-w-[640px]" style={{ minWidth: days.length === 1 ? 0 : undefined }}>
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => (
            <Link key={d} href={dayHref(d)} className="flex flex-col items-center py-2 hover:bg-sunken/60">
              <span className="text-xs font-semibold text-muted uppercase">{WD[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
              <span className={cn("mt-0.5 inline-flex size-8 items-center justify-center rounded-full text-lg font-semibold", d === today && "bg-primary-600 text-white")}>{Number(d.slice(8))}</span>
            </Link>
          ))}
        </div>
        {/* All-day row */}
        <div className="grid border-b border-line bg-sunken/30" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div className="py-1.5 pr-2 text-right text-[11px] text-muted">all day</div>
          {days.map((d) => (
            <div key={d} className="flex min-h-9 flex-col gap-0.5 border-l border-line p-1">
              {(byDay.get(d) ?? [])
                .filter((i) => i.startMin === null)
                .map((i) => (
                  <Chip key={i.key} item={i} compact />
                ))}
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: ((h - DAY_START) / 60) * HOUR_PX }}>
                {h === DAY_START ? "" : fmtMin(h)}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const timed = (byDay.get(d) ?? []).filter((i) => i.startMin !== null);
            return (
              <div key={d} className={cn("relative border-l border-line", d === today && "bg-primary-50/40")} style={{ height }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: ((h - DAY_START) / 60) * HOUR_PX }} />
                ))}
                {timed.map((i, idx) => {
                  const s = Math.max(DAY_START, Math.min(DAY_END - 30, i.startMin!));
                  const e = Math.max(s + 30, Math.min(DAY_END, i.endMin ?? s + 60));
                  const overlaps = timed.filter((o) => o.startMin! < (i.endMin ?? i.startMin! + 60) && (o.endMin ?? o.startMin! + 60) > i.startMin!);
                  const lane = overlaps.indexOf(i);
                  const lanes = overlaps.length;
                  const c = colorOf(i.color);
                  return (
                    <Link
                      key={i.key + idx}
                      href={i.href}
                      title={i.title}
                      className="absolute overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-xs leading-tight hover:brightness-95"
                      style={{
                        top: ((s - DAY_START) / 60) * HOUR_PX + 1,
                        height: ((e - s) / 60) * HOUR_PX - 2,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        background: c.soft,
                        color: c.ink,
                        borderColor: c.solid,
                      }}
                    >
                      <span className="block font-semibold">{i.title}</span>
                      <span className="opacity-75">
                        {fmtMin(i.startMin!)}
                        {i.endMin ? `–${fmtMin(i.endMin)}` : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AgendaView({ items, today, from, days, members }: { items: CalendarItem[]; today: string; from: string; days: number; members: { id: string; displayName: string; color: string }[] }) {
  const byDay = Map.groupBy(items, (i) => i.date);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i)).filter((d) => byDay.has(d));
  if (!dates.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {dates.map((d) => (
        <section key={d} className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <h2 className={cn("font-sans text-sm font-semibold", d === today ? "text-primary-600" : "text-muted")}>
            {d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}
            <span className="block text-xs font-normal">{formatShortDate(d)}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {byDay.get(d)!.map((i) => {
              const c = colorOf(i.color);
              const people = i.people.map((p) => members.find((m) => m.id === p)).filter(Boolean);
              return (
                <li key={i.key}>
                  <Link href={i.href} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300">
                    <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: c.solid }} aria-hidden />
                    <span className="w-20 shrink-0 text-sm text-muted tabular-nums">{i.startMin === null ? "All day" : fmtMin(i.startMin)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("truncate font-medium", i.done && "text-muted line-through")}>{i.title}</span>
                      <span className="flex items-center gap-2 truncate text-sm text-muted">
                        {i.recurring && <Repeat className="size-3.5" aria-label="Repeats" />}
                        {i.location}
                        {people.length > 0 && <span>{people.map((p) => p!.displayName.split(" ")[0]).join(", ")}</span>}
                      </span>
                    </span>
                    <span className="hidden text-xs text-muted capitalize sm:inline">{i.layer === "events" ? "" : i.layer}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
