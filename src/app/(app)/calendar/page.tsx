import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ListView, MonthView, TimeGridView, TYPE_LABEL, VIS_LABEL } from "@/components/calendar/views";
import { EventFormModal } from "@/components/calendar/event-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { memberColor, isMemberColor } from "@/lib/colors";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { ensureCalendarCategories, getCalendarItems, LAYERS, type Layer } from "@/lib/calendar";
import { getViewer } from "@/lib/dal";
import { addDays, addMonths, daysBetween, monthLabel, startOfMonth, startOfWeek, todayIn } from "@/lib/dates";
import { categoryOptions, memberOptions } from "@/lib/queries";
import { CalendarCategoriesButton } from "@/components/calendar/category-panel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const VIEWS = ["month", "week", "day", "list"] as const;
type View = (typeof VIEWS)[number];
const PRESETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "upcoming", label: "Upcoming" },
  { key: "custom", label: "Custom range" },
] as const;
type Preset = (typeof PRESETS)[number]["key"];
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const LAYER_LABEL: Record<Layer, string> = { events: "Events", chores: "Chores", workouts: "Workouts", meals: "Meals", garden: "Garden", farm: "Farm", pets: "Pets", home: "Home projects", moon: "Moon & sabbats", cycle: "My cycle (private)" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const viewer = await getViewer();
  if (!viewer.can("calendar")) notFound();
  await ensureCalendarCategories(viewer);
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const view: View = sp.view === "agenda" ? "list" : VIEWS.includes(sp.view as View) ? (sp.view as View) : "month";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const member = typeof sp.member === "string" ? sp.member : "";
  const layers = (typeof sp.layers === "string" ? sp.layers.split(",") : ["events", "chores", "workouts"]).filter((l): l is Layer => (LAYERS as readonly string[]).includes(l));
  const ws = viewer.family.settings?.weekStartsOn ?? 0;

  // List view: a preset or custom range (max one year) plus filters.
  const preset: Preset = PRESETS.some((p) => p.key === sp.range) ? (sp.range as Preset) : "upcoming";
  const ws0 = startOfWeek(today, ws);
  const listRange = (() => {
    if (preset === "today") return { from: today, to: today };
    if (preset === "week") return { from: ws0, to: addDays(ws0, 6) };
    if (preset === "month") return { from: startOfMonth(today), to: addDays(addMonths(today, 1), -1) };
    if (preset === "custom") {
      const from = isoDate(sp.from) ?? today;
      let to = isoDate(sp.to) ?? addDays(from, 30);
      if (to < from) to = from;
      if (daysBetween(from, to) > 366) to = addDays(from, 366);
      return { from, to };
    }
    return { from: today, to: addDays(today, 90) };
  })();
  const f = { category: str(sp.category), type: str(sp.type), vis: str(sp.vis), color: str(sp.color), q: str(sp.q).trim() };

  const range =
    view === "list"
      ? listRange
      : view === "month"
      ? { from: startOfWeek(startOfMonth(date), ws), to: addDays(startOfWeek(startOfMonth(date), ws), 41) }
      : view === "week"
        ? { from: startOfWeek(date, ws), to: addDays(startOfWeek(date, ws), 6) }
        : { from: date, to: date };

  const [members, cats, allItems] = await Promise.all([
    memberOptions(viewer),
    categoryOptions(viewer, "calendar"),
    getCalendarItems(viewer, range.from, range.to, { layers, memberId: member || null }),
  ]);

  const typeOf = (i: (typeof allItems)[number]) => (i.layer === "events" ? (i.type ?? "event") : i.layer);
  const needle = f.q.toLowerCase();
  const items =
    view !== "list"
      ? allItems
      : allItems.filter(
          (i) =>
            (!f.category || i.categoryId === f.category) &&
            (!f.type || typeOf(i) === f.type) &&
            (!f.vis || (i.visibility ?? "family") === f.vis) &&
            (!f.color || i.color === f.color) &&
            (!needle || [i.title, i.location, i.category, i.description].some((x) => x?.toLowerCase().includes(needle))),
        );
  const typeOptions = [...new Set(allItems.map(typeOf))].sort();
  const colorOptions = [...new Set(allItems.map((i) => i.color))].filter((c) => isMemberColor(c));
  const filtered = Object.values(f).some(Boolean);

  const q = (p: Record<string, string>) => {
    const params = new URLSearchParams({ view, date, ...(member ? { member } : {}), layers: layers.join(","), ...p });
    if (!params.get("member")) params.delete("member");
    return `/calendar?${params}`;
  };
  const step = (n: number) => (view === "month" ? addMonths(date, n) : view === "week" ? addDays(date, 7 * n) : addDays(date, n));
  const short = (d: string, year = false) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  const title =
    view === "list"
      ? range.from === range.to
        ? short(range.from, true)
        : `${short(range.from)} – ${short(range.to, true)}`
      : view === "month"
      ? monthLabel(date)
      : view === "day"
        ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
        : `${new Date(`${range.from}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${range.to}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  const toggleLayer = (l: Layer) => (layers.includes(l) ? layers.filter((x) => x !== l) : [...layers, l]).join(",");
  const availableLayers = LAYERS.filter((l) => ({ events: true, chores: viewer.can("chores") || viewer.can("cleaning") || viewer.can("maintenance"), workouts: viewer.can("fitness"), meals: viewer.can("meals"), garden: viewer.can("garden"), farm: viewer.can("farm"), pets: viewer.can("pets"), home: viewer.can("maintenance"), moon: viewer.can("witchcraft"), cycle: true })[l]);
  const canEdit = viewer.can("calendar", "edit");

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Everyone's schedule in one place, with privacy per event."
        actions={
          canEdit || viewer.isParent ? (
            <>
              {viewer.isParent && <CalendarCategoriesButton items={cats.map((c) => ({ id: c.id, name: c.name, color: c.color }))} />}
              {canEdit && <EventFormModal members={members} categories={cats} defaultDate={view === "month" ? today : date} defaultOpen={sp.new === "1"} me={viewer.member.id} />}
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          {view !== "list" && (
            <>
          <Link href={q({ date: step(-1) })} aria-label="Previous" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronLeft className="size-5" />
          </Link>
          <Link href={q({ date: step(1) })} aria-label="Next" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronRight className="size-5" />
          </Link>
          <Link href={q({ date: today })} className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium hover:bg-sunken">
            Today
          </Link>
            </>
          )}
          <h2 className="ml-2 text-xl font-semibold sm:text-2xl">{title}</h2>
        </div>
        <SegmentLinks active={view} items={VIEWS.map((v) => ({ key: v, href: q({ view: v }), label: v[0]!.toUpperCase() + v.slice(1) }))} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5" aria-label="Filter by person">
          <Link href={q({ member: "" })} className={cn("h-9 rounded-full px-3 text-sm leading-9 font-medium", !member ? "bg-ink text-white" : "text-muted hover:bg-sunken")}>
            Everyone
          </Link>
          {members.map((m) => (
            <Link key={m.id} href={q({ member: m.id })} title={m.displayName} className={cn("rounded-full p-0.5", member === m.id ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100")}>
              <Avatar name={m.displayName} color={m.color} size="sm" />
              <span className="sr-only">{m.displayName}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Show on calendar">
          {availableLayers.map((l) => (
            <Link
              key={l}
              href={q({ layers: toggleLayer(l) })}
              aria-pressed={layers.includes(l)}
              className={cn("h-8 rounded-full border px-3 text-xs leading-7 font-medium", layers.includes(l) ? "border-primary-300 bg-primary-50 text-primary-700" : "border-line text-muted hover:bg-sunken")}
            >
              {LAYER_LABEL[l]}
            </Link>
          ))}
        </div>
      </div>

      {view === "list" && (
        <Card className="mb-5 !p-4">
          <form action="/calendar" className="flex flex-col gap-3">
            <input type="hidden" name="view" value="list" />
            <input type="hidden" name="layers" value={layers.join(",")} />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="submit"
                  name="range"
                  value={p.key}
                  aria-pressed={preset === p.key}
                  className={cn("h-9 rounded-full px-3.5 text-sm font-medium", preset === p.key ? "bg-ink text-white" : "border border-line text-ink-soft hover:bg-sunken")}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="relative sm:col-span-2">
                <span className="sr-only">Search events</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input name="q" defaultValue={f.q} placeholder="Search names, places, notes…" className="pl-9" />
              </label>
              <Select name="member" defaultValue={member} aria-label="Family member">
                <option value="">Everyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </Select>
              <Select name="category" defaultValue={f.category} aria-label="Category">
                <option value="">All categories</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select name="type" defaultValue={f.type} aria-label="Event type">
                <option value="">All types</option>
                {[...new Set([...typeOptions, ...(f.type ? [f.type] : [])])].map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t] ?? t}
                  </option>
                ))}
              </Select>
              <Select name="vis" defaultValue={f.vis} aria-label="Shared or private">
                <option value="">Shared &amp; private</option>
                {Object.entries(VIS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
              <Select name="color" defaultValue={f.color} aria-label="Color">
                <option value="">All colors</option>
                {[...new Set([...colorOptions, ...(f.color ? [f.color] : [])])].map((c) => (
                  <option key={c} value={c}>
                    {memberColor(c).label}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Button type="submit" name="range" value={preset} className="flex-1">
                  Apply
                </Button>
                {(filtered || member) && (
                  <Link href={`/calendar?view=list&range=${preset}&layers=${layers.join(",")}`} className="inline-flex h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-muted hover:bg-sunken">
                    Clear
                  </Link>
                )}
              </div>
            </div>
            {preset === "custom" && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm text-muted">
                  From
                  <Input type="date" name="from" defaultValue={range.from} className="mt-1" />
                </label>
                <label className="text-sm text-muted">
                  To
                  <Input type="date" name="to" defaultValue={range.to} className="mt-1" />
                </label>
              </div>
            )}
          </form>
        </Card>
      )}

      {view === "month" && <MonthView month={date} items={items} today={today} weekStartsOn={ws} dayHref={(d) => q({ view: "day", date: d })} members={members} />}
      {(view === "week" || view === "day") && (
        <TimeGridView days={view === "day" ? [date] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i))} items={items} today={today} dayHref={(d) => q({ view: "day", date: d })} members={members} />
      )}
      {view === "day" && items.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-sans text-base font-semibold">Details</h2>
          <ListView items={items} today={today} members={members} />
        </section>
      )}
      {view === "list" &&
        (items.length ? (
          <ListView items={items} today={today} members={members} />
        ) : (
          <Card>
            <EmptyState
              icon={<CalendarDays />}
              title={filtered ? "Nothing matches these filters" : "Nothing scheduled in this range"}
              description={filtered ? "Try a wider date range or clear a filter." : "Add appointments, practices, birthdays and family plans."}
              action={canEdit ? <EventFormModal members={members} categories={cats} defaultDate={today} me={viewer.member.id} /> : undefined}
            />
          </Card>
        ))}
    </>
  );
}
