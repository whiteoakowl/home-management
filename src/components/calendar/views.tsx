import Link from "next/link";
import { Check, Lock, MapPin, Repeat, Users } from "lucide-react";
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

type Member = { id: string; displayName: string; color: string };

const fmtRange = (i: CalendarItem) => (i.startMin === null ? "All day" : `${fmtMin(i.startMin)}${i.endMin ? `–${fmtMin(i.endMin)}` : ""}`);
const firstNames = (i: CalendarItem, members: Member[]) =>
  i.people
    .map((p) => members.find((m) => m.id === p)?.displayName.split(" ")[0])
    .filter(Boolean)
    .join(", ");

export const TYPE_LABEL: Record<string, string> = {
  event: "Event",
  medical: "Medical appointment",
  celebration: "Celebration",
  pet: "Pet care",
  chore: "Chore",
  workout: "Workout",
  meal: "Meal",
  garden: "Garden",
  farm: "Farm",
  chores: "Chore / task",
  workouts: "Workout",
  meals: "Meal",
  pets: "Pet care",
  home: "Home maintenance",
  moon: "Moon & sabbat",
  cycle: "Cycle (private)",
};
export const VIS_LABEL = { family: "Family", private: "Only me", selected: "Shared with selected", parents: "Parents & me" } as const;

/** Hover/long-press text: the full name plus the useful details. */
function tip(i: CalendarItem, members: Member[] = []) {
  return [i.title, fmtRange(i), i.location, firstNames(i, members), i.category].filter(Boolean).join(" · ");
}

/** Coloured bar with the item's name (truncated; full details in the tooltip). */
function Bar({ item, members, showTime = true }: { item: CalendarItem; members?: Member[]; showTime?: boolean }) {
  const c = colorOf(item.color);
  return (
    <Link
      href={item.href}
      title={tip(item, members)}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-[2px] border-l-[1.5px] pr-0 pl-px text-[7.5px] leading-[9px] font-medium tracking-[-0.03em] hover:brightness-95 sm:rounded-[5px] sm:border-l-[3px] sm:px-1.5 sm:py-0.5 sm:text-xs sm:leading-4 sm:tracking-normal",
        item.done && "line-through opacity-60",
      )}
      style={{ background: c.soft, color: c.ink, borderColor: c.solid }}
    >
      {item.layer === "chores" && <Check className="hidden size-3 shrink-0 sm:block" aria-hidden />}
      {showTime && item.startMin !== null && <span className="hidden shrink-0 tabular-nums opacity-75 sm:inline">{fmtMin(item.startMin)}</span>}
      <span className="overflow-hidden whitespace-nowrap sm:truncate">{item.title}</span>
    </Link>
  );
}

export function MonthView({ month, items, today, weekStartsOn, dayHref, members = [] }: { month: string; items: CalendarItem[]; today: string; weekStartsOn: 0 | 1; dayHref: (d: string) => string; members?: Member[] }) {
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
            <div key={d} className={cn("min-h-24 min-w-0 border-r border-b border-line px-0 pt-0.5 pb-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-sunken/40")}>
              <Link
                href={dayHref(d)}
                className={cn(
                  "mb-px ml-0.5 inline-flex size-[18px] items-center justify-center rounded-full text-[11px] sm:mb-1 sm:ml-0 sm:size-7 sm:text-sm",
                  d === today ? "bg-primary-600 font-semibold text-white" : inMonth ? "text-ink hover:bg-sunken" : "text-muted",
                )}
              >
                {Number(d.slice(8))}
              </Link>
              <div className="flex flex-col gap-px sm:gap-0.5">
                {/* Phone: up to 7 slim bars; larger screens: 3. */}
                {list.slice(0, 7).map((i, k) => (
                  <div key={i.key} className={cn(k >= 3 && "sm:hidden", list.length > 7 && k === 6 && "hidden")}>
                    <Bar item={i} members={members} />
                  </div>
                ))}
                {list.length > 7 && (
                  <Link href={dayHref(d)} className="px-0.5 text-[8px] leading-[10px] font-medium text-muted hover:text-ink sm:hidden">
                    +{list.length - 6} more
                  </Link>
                )}
                {list.length > 3 && (
                  <Link href={dayHref(d)} className="hidden px-1 text-xs font-medium text-muted hover:text-ink sm:block">
                    {list.length - 3} more
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
export function TimeGridView({ days, items, today, dayHref, members = [] }: { days: string[]; items: CalendarItem[]; today: string; dayHref: (d: string) => string; members?: Member[] }) {
  const single = days.length === 1;
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
                  <Bar key={i.key} item={i} members={members} />
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
                      title={tip(i, members)}
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
                      <span className="block truncate font-semibold">{i.title}</span>
                      <span className="block truncate opacity-75">{fmtRange(i)}</span>
                      {firstNames(i, members) && <span className="block truncate opacity-75">{firstNames(i, members)}</span>}
                      {single && i.location && <span className="block truncate opacity-75">{i.location}</span>}
                      {single && i.category && <span className="block truncate opacity-75">{i.category}</span>}
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

/** One row of the List view / day details: everything about the item at a glance. */
function ListRow({ i, members }: { i: CalendarItem; members: Member[] }) {
  const c = colorOf(i.color);
  const who = firstNames(i, members);
  const type = i.layer === "events" ? (i.type ?? "event") : i.layer;
  return (
    <li>
      <Link href={i.href} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300">
        <span className="mt-0.5 h-11 w-1.5 shrink-0 rounded-full" style={{ background: c.solid }} aria-hidden />
        <span className="w-20 shrink-0 pt-0.5 text-sm text-muted tabular-nums">{fmtRange(i)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn("flex items-center gap-1.5 font-medium", i.done && "text-muted line-through")}>
            <span className="truncate">{i.title}</span>
            {i.recurring && <Repeat className="size-3.5 shrink-0 text-muted" aria-label="Repeats" />}
            {i.visibility && i.visibility !== "family" && <Lock className="size-3.5 shrink-0 text-muted" aria-label={VIS_LABEL[i.visibility]} />}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: c.solid }} aria-hidden />
              {i.category ?? TYPE_LABEL[type] ?? type}
            </span>
            {who && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {who}
              </span>
            )}
            {i.location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{i.location}</span>
              </span>
            )}
            <span>{VIS_LABEL[i.visibility ?? "family"]}</span>
            {i.recurring && <span>Repeats</span>}
          </span>
          {i.description && <span className="line-clamp-2 text-sm text-ink-soft">{i.description}</span>}
        </span>
      </Link>
    </li>
  );
}

const dayHeading = (d: string, today: string) =>
  d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : d === addDays(today, -1) ? "Yesterday" : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/** Chronological list grouped by date (List view and the day view's details). */
export function ListView({ items, today, members }: { items: CalendarItem[]; today: string; members: Member[] }) {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.startMin ?? -1) - (b.startMin ?? -1) || a.title.localeCompare(b.title));
  const byDay = Map.groupBy(sorted, (i) => i.date);
  return (
    <div className="flex flex-col gap-5">
      {[...byDay.keys()].map((d) => (
        <section key={d} className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <h2 className={cn("font-sans text-sm font-semibold", d === today ? "text-primary-600" : "text-muted")}>
            {dayHeading(d, today)}
            <span className="block text-xs font-normal">{formatShortDate(d)}</span>
          </h2>
          <ul className="flex min-w-0 flex-col gap-2">
            {byDay.get(d)!.map((i) => (
              <ListRow key={i.key} i={i} members={members} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
