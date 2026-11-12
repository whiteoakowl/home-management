import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AgendaView, MonthView, TimeGridView } from "@/components/calendar/views";
import { EventFormModal } from "@/components/calendar/event-form";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { ensureCalendarCategories, getCalendarItems, LAYERS, type Layer } from "@/lib/calendar";
import { getViewer } from "@/lib/dal";
import { addDays, addMonths, monthLabel, startOfMonth, startOfWeek, todayIn } from "@/lib/dates";
import { categoryOptions, memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const VIEWS = ["month", "week", "day", "agenda"] as const;
type View = (typeof VIEWS)[number];
const LAYER_LABEL: Record<Layer, string> = { events: "Events", chores: "Chores", workouts: "Workouts", meals: "Meals", garden: "Garden", farm: "Farm" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const viewer = await getViewer();
  if (!viewer.can("calendar")) notFound();
  await ensureCalendarCategories(viewer);
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "month";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const member = typeof sp.member === "string" ? sp.member : "";
  const layers = (typeof sp.layers === "string" ? sp.layers.split(",") : ["events", "chores", "workouts"]).filter((l): l is Layer => (LAYERS as readonly string[]).includes(l));
  const ws = viewer.family.settings?.weekStartsOn ?? 0;

  const range =
    view === "month"
      ? { from: startOfWeek(startOfMonth(date), ws), to: addDays(startOfWeek(startOfMonth(date), ws), 41) }
      : view === "week"
        ? { from: startOfWeek(date, ws), to: addDays(startOfWeek(date, ws), 6) }
        : view === "day"
          ? { from: date, to: date }
          : { from: date, to: addDays(date, 29) };

  const [members, cats, items] = await Promise.all([
    memberOptions(viewer),
    categoryOptions(viewer, "calendar"),
    getCalendarItems(viewer, range.from, range.to, { layers, memberId: member || null }),
  ]);

  const q = (p: Record<string, string>) => {
    const params = new URLSearchParams({ view, date, ...(member ? { member } : {}), layers: layers.join(","), ...p });
    if (!params.get("member")) params.delete("member");
    return `/calendar?${params}`;
  };
  const step = (n: number) => (view === "month" ? addMonths(date, n) : view === "week" ? addDays(date, 7 * n) : view === "day" ? addDays(date, n) : addDays(date, 30 * n));
  const title =
    view === "month"
      ? monthLabel(date)
      : view === "day"
        ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
        : `${new Date(`${range.from}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${range.to}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  const toggleLayer = (l: Layer) => (layers.includes(l) ? layers.filter((x) => x !== l) : [...layers, l]).join(",");
  const availableLayers = LAYERS.filter((l) => ({ events: true, chores: viewer.can("chores") || viewer.can("house"), workouts: viewer.can("fitness"), meals: viewer.can("meals"), garden: viewer.can("garden"), farm: viewer.can("farm") })[l]);
  const canEdit = viewer.can("calendar", "edit");

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Everyone's schedule in one place, with privacy per event."
        actions={canEdit ? <EventFormModal members={members} categories={cats} defaultDate={view === "month" ? today : date} defaultOpen={sp.new === "1"} me={viewer.member.id} /> : undefined}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Link href={q({ date: step(-1) })} aria-label="Previous" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronLeft className="size-5" />
          </Link>
          <Link href={q({ date: step(1) })} aria-label="Next" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronRight className="size-5" />
          </Link>
          <Link href={q({ date: today })} className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium hover:bg-sunken">
            Today
          </Link>
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

      {view === "month" && <MonthView month={date} items={items} today={today} weekStartsOn={ws} dayHref={(d) => q({ view: "day", date: d })} />}
      {(view === "week" || view === "day") && (
        <TimeGridView days={view === "day" ? [date] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i))} items={items} today={today} dayHref={(d) => q({ view: "day", date: d })} />
      )}
      {view === "agenda" &&
        (items.length ? (
          <AgendaView items={items} today={today} from={range.from} days={30} members={members} />
        ) : (
          <Card>
            <EmptyState icon={<CalendarDays />} title="Nothing in the next 30 days" description="Add appointments, practices, birthdays and family plans." action={canEdit ? <EventFormModal members={members} categories={cats} defaultDate={today} me={viewer.member.id} /> : undefined} />
          </Card>
        ))}
    </>
  );
}
