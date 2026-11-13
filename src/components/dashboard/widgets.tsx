import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlarmClock,
  Bird,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  Dumbbell,
  Megaphone,
  NotebookPen,
  PiggyBank,
  Refrigerator,
  ShoppingBasket,
  Sprout,
  Target,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, ProgressBar, ProgressRing } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import * as data from "@/lib/dashboard-data";
import type { Scope } from "@/lib/dashboard-data";
import { daysBetween, formatLongDate, formatShortDate, formatTime, greeting, relativeTime } from "@/lib/dates";
import { memberColor } from "@/lib/colors";
import { formatCents, plural } from "@/lib/utils";
import { getWeather } from "@/lib/weather";
import { AnnouncementComposer } from "./announcement-composer";
import { setOccurrenceDone } from "@/app/actions/chores";
import { CheckCircle } from "@/components/forms/inline";
import { HealthWidget, HomeUpkeepWidget, MoonWidget, PetsWidget } from "./addon-widgets";

const ic = "size-4";

function Row({ children, href }: { children: ReactNode; href?: string }) {
  const cls = "flex items-center gap-3 rounded-xl px-2 py-2 -mx-2";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-sunken`}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

function dueLabel(today: string, date: string | null) {
  if (!date) return null;
  const d = daysBetween(today, date);
  if (d < 0) return { text: d === -1 ? "Yesterday" : `${-d} days ago`, tone: "wine" as const };
  if (d === 0) return { text: "Today", tone: "olive" as const };
  if (d === 1) return { text: "Tomorrow", tone: "olive" as const };
  return { text: formatShortDate(date), tone: "neutral" as const };
}

// ─── Today ───────────────────────────────────────────────────────────────────

export async function TodayWidget({ scope, name }: { scope: Scope; name: string }) {
  const { viewer, today } = scope;
  const showChores = viewer.can("chores");
  const showEvents = viewer.can("calendar");
  const [chores, events] = await Promise.all([
    showChores ? data.getChoreSummary(scope) : null,
    showEvents ? data.getEvents(scope, 1) : null,
  ]);
  const remaining = chores ? chores.total - chores.done : 0;
  const stats = [
    showChores && { label: "chores left today", value: remaining, href: "/house/chores" },
    showChores && chores!.overdue.length > 0 && { label: "overdue", value: chores!.overdue.length, href: "/house/chores", tone: "wine" },
    showEvents && { label: plural(events!.today.length, "event").replace(/^\d+ /, "") + " today", value: events!.today.length, href: "/calendar" },
  ].filter(Boolean) as { label: string; value: number; href: string; tone?: string }[];

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 text-white border-primary-800">
      <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -top-10 -right-10 size-56 opacity-[0.12]">
        <path d="M100 10c40 30 60 70 40 120-30-10-55-40-60-80 25 10 40 30 45 55" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M60 40c-30 30-35 70-10 110 20-20 30-50 20-85" fill="none" stroke="#fff" strokeWidth="3" />
      </svg>
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-200">{formatLongDate(today)}</p>
          <h2 className="mt-1 text-[28px] leading-tight font-semibold text-white sm:text-[34px]">
            {greeting(viewer.family.timezone)}, {name}
          </h2>
          <p className="mt-1 text-[15px] text-primary-100">
            {chores && chores.total > 0 && remaining === 0
              ? "Everything on today's list is done. Nice work!"
              : "Here's what needs doing today."}
          </p>
        </div>
        {chores && chores.total > 0 && (
          <div className="hidden sm:block">
          <ProgressRing value={chores.done} max={chores.total} size={72}>
            <span className="text-white">
              {chores.done}/{chores.total}
            </span>
          </ProgressRing>
          </div>
        )}
      </div>
      {stats.length > 0 && (
        <div className="relative mt-5 flex flex-wrap gap-2">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm backdrop-blur transition-colors ${s.tone === "wine" ? "bg-wine-500/70 hover:bg-wine-500" : "bg-white/12 hover:bg-white/20"}`}
            >
              <span className="font-semibold">{s.value}</span> {s.label}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Chores & tasks ──────────────────────────────────────────────────────────

export async function ChoresWidget({ scope, kind = "chore" }: { scope: Scope; kind?: "chore" | "task" }) {
  const s = await data.getChoreSummary(scope, kind);
  const isTask = kind === "task";
  const items = [...s.overdue, ...s.today.filter((r) => r.status === "pending")].slice(0, 6);
  return (
    <Card>
      <CardHeader
        title={isTask ? "Tasks" : scope.subjectId ? "Chores" : "Today's chores"}
        icon={isTask ? <ClipboardCheck className={ic} /> : <CheckCircle2 className={ic} />}
        href={isTask ? "/house/tasks" : "/house/chores"}
      />
      {!isTask && s.total > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <ProgressBar value={s.done} max={s.total} label="Chores completed today" />
          <span className="shrink-0 text-sm text-muted">
            {s.done}/{s.total}
          </span>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<CheckCircle2 />}
          title={s.total > 0 ? "All done for today" : isTask ? "No tasks due" : "No chores yet"}
          description={
            s.total > 0
              ? "Every chore on today's list has been completed."
              : isTask
                ? "One-off tasks with due dates will show up here."
                : "Create recurring chores and assign them to family members."
          }
          action={s.total === 0 && scope.viewer.can("chores", "edit") ? <ButtonLink href={isTask ? "/house/tasks?new=task" : "/house/chores?new=1"} size="sm" variant="soft">{isTask ? "Add a task" : "Set up chores"}</ButtonLink> : undefined}
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((c) => {
            const due = dueLabel(scope.today, c.dueDate);
            return (
              <li key={c.id}>
                <Row>
                  <CheckCircle action={setOccurrenceDone} id={c.id} done={false} label={`Mark "${c.title}" done`} size="sm" />
                  <Link href={isTask ? "/house/tasks" : "/house/chores"} className="min-w-0 flex-1 truncate text-[15px] hover:underline">
                    {c.title}
                  </Link>
                  {due && due.tone !== "olive" && <Badge tone={due.tone}>{due.text}</Badge>}
                  {c.assigneeName && !scope.subjectId && <Avatar name={c.assigneeName} color={c.assigneeColor} size="xs" />}
                </Row>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function EventsWidget({ scope }: { scope: Scope }) {
  const { today, upcoming } = await data.getEvents(scope);
  const tz = scope.viewer.family.timezone;
  const all = [...today, ...upcoming].slice(0, 6);
  return (
    <Card>
      <CardHeader title="Events" icon={<CalendarDays className={ic} />} href="/calendar" hrefLabel="Calendar" />
      {all.length === 0 ? (
        <EmptyState compact icon={<CalendarDays />} title="Nothing scheduled" description="No events in the next 7 days." />
      ) : (
        <ul className="flex flex-col">
          {all.map((e) => (
            <li key={e.id}>
              <Row href="/calendar">
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: memberColor(e.color).solid }} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">{e.title}</span>
                  <span className="truncate text-sm text-muted">
                    {e.localDate === scope.today ? "Today" : formatShortDate(e.localDate)}
                    {!e.allDay && ` · ${formatTime(e.startsAt, tz)}`}
                    {e.location && ` · ${e.location}`}
                  </span>
                </span>
              </Row>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Weather ─────────────────────────────────────────────────────────────────

export async function WeatherWidget({ scope }: { scope: Scope }) {
  const f = scope.viewer.family;
  const w = await getWeather(f.latitude, f.longitude, f.timezone);
  return (
    <Card className="bg-gradient-to-br from-mist-50 to-surface">
      <CardHeader title="Weather" icon={<CloudSun className={ic} />} />
      {w ? (
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-5xl font-semibold">{w.tempF}°</p>
            <p className="mt-1 text-[15px] text-ink-soft">{w.label}</p>
          </div>
          <p className="text-sm text-muted">
            H {w.highF}° · L {w.lowF}°
          </p>
        </div>
      ) : (
        <EmptyState
          compact
          icon={<CloudSun />}
          title={f.latitude == null ? "Add your location" : "Weather unavailable"}
          description={
            f.latitude == null
              ? "Set your home's coordinates in Settings to see local weather."
              : "We couldn't reach the weather service right now."
          }
          action={f.latitude == null && scope.viewer.isParent ? <ButtonLink href="/settings" size="sm" variant="soft">Open settings</ButtonLink> : undefined}
        />
      )}
    </Card>
  );
}

// ─── Announcements ───────────────────────────────────────────────────────────

export async function AnnouncementsWidget({ scope }: { scope: Scope }) {
  const rows = await data.getAnnouncements(scope);
  return (
    <Card>
      <CardHeader
        title="Announcements"
        icon={<Megaphone className={ic} />}
        action={scope.viewer.isParent ? <AnnouncementComposer /> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={<Megaphone />}
          title="No announcements"
          description={scope.viewer.isParent ? "Share a note with the whole family." : "Notes from parents will appear here."}
          example={scope.viewer.isParent ? "“Grandma visits Saturday. Rooms tidy by Friday!”" : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((a) => (
            <li key={a.id} className="rounded-xl bg-sunken/60 p-3">
              <p className="text-[15px] whitespace-pre-line">{a.body}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                {a.authorName && <Avatar name={a.authorName} color={a.authorColor} size="xs" />}
                {a.authorName} · {relativeTime(a.createdAt)}
                {a.pinned && <Badge tone="primary">Pinned</Badge>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Kitchen ─────────────────────────────────────────────────────────────────

const SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" } as const;

export async function MealsWidget({ scope }: { scope: Scope }) {
  const meals = await data.getMealsToday(scope);
  return (
    <Card>
      <CardHeader title="Today's meals" icon={<UtensilsCrossed className={ic} />} href="/meals" hrefLabel="Meal plan" />
      {meals.length === 0 ? (
        <EmptyState compact icon={<UtensilsCrossed />} title="No meals planned" description="Plan the week and the shopping list builds itself." />
      ) : (
        <dl className="flex flex-col gap-2">
          {meals.map((m) => (
            <div key={m.slot} className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-muted">{SLOT_LABEL[m.slot]}</dt>
              <dd className="truncate text-right text-[15px] font-medium">{m.recipeName ?? m.title}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

export async function ShoppingWidget({ scope }: { scope: Scope }) {
  const { items, count } = await data.getShopping(scope);
  return (
    <Card>
      <CardHeader title="Shopping list" icon={<ShoppingBasket className={ic} />} href="/shopping" />
      {items.length === 0 ? (
        <EmptyState compact icon={<ShoppingBasket />} title="Nothing to buy" description="Items from recipes, low stock and your own notes land here." />
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2.5 text-[15px]">
                <span className="size-4 rounded border-2 border-line-strong" aria-hidden />
                <span className="flex-1 truncate">{i.text}</span>
                {i.quantity && (
                  <span className="text-sm text-muted">
                    {Number(i.quantity)} {i.unit}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {count > items.length && <p className="mt-3 text-sm text-muted">+{count - items.length} more</p>}
        </>
      )}
    </Card>
  );
}

export async function PantryWidget({ scope }: { scope: Scope }) {
  const { expiring, low } = await data.getPantryAlerts(scope);
  return (
    <Card>
      <CardHeader title="Pantry alerts" icon={<Refrigerator className={ic} />} href="/kitchen" hrefLabel="Kitchen" />
      {expiring.length === 0 && low === 0 ? (
        <EmptyState compact icon={<Refrigerator />} title="All fresh" description="Nothing expiring this week and nothing running low." />
      ) : (
        <ul className="flex flex-col gap-2">
          {expiring.map((i) => {
            const d = daysBetween(scope.today, i.expiresOn!);
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 text-[15px]">
                <span className="truncate">{i.name}</span>
                <Badge tone={d < 0 ? "wine" : d <= 2 ? "olive" : "neutral"}>
                  {d < 0 ? "Expired" : d === 0 ? "Today" : `${d}d`}
                </Badge>
              </li>
            );
          })}
          {low > 0 && <li className="pt-1 text-sm text-muted">{plural(low, "item")} running low</li>}
        </ul>
      )}
    </Card>
  );
}

// ─── Land ────────────────────────────────────────────────────────────────────

export async function GardenWidget({ scope }: { scope: Scope }) {
  const { growing, harvests } = await data.getGarden(scope);
  return (
    <Card>
      <CardHeader title="Garden" icon={<Sprout className={ic} />} href="/garden" />
      {growing === 0 && harvests.length === 0 ? (
        <EmptyState compact icon={<Sprout />} title="Nothing planted yet" description="Plan your beds and track plantings through harvest." />
      ) : (
        <>
          <p className="text-[15px]">
            <span className="font-display text-3xl font-semibold">{growing}</span> <span className="text-muted">plantings growing</span>
          </p>
          {harvests.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {harvests.map((h) => (
                <li key={h.id} className="flex justify-between text-sm">
                  <span>
                    {h.name}
                    {h.variety && <span className="text-muted"> · {h.variety}</span>}
                  </span>
                  <span className="text-muted">{formatShortDate(h.date!)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

export async function FarmWidget({ scope }: { scope: Scope }) {
  const { head, weekly, healthDue } = await data.getFarm(scope);
  return (
    <Card>
      <CardHeader title="Farm" icon={<Bird className={ic} />} href="/farm" />
      {head === 0 ? (
        <EmptyState compact icon={<Bird />} title="No animals yet" description="Add your flock or herd to track care and production." />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[15px]">
            <span className="font-display text-3xl font-semibold">{head}</span> <span className="text-muted">animals</span>
          </p>
          {weekly.length > 0 && (
            <p className="text-sm text-ink-soft">
              This week: {weekly.map((w) => `${Number(w.total)} ${w.unit} ${w.kind}`).join(" · ")}
            </p>
          )}
          {healthDue.map((h) => (
            <p key={h.id} className="flex items-center gap-2 text-sm">
              <AlarmClock className="size-4 text-olive-500" aria-hidden />
              {h.animal}: {h.kind} {h.nextDueOn && `· ${formatShortDate(h.nextDueOn)}`}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Money & goals ───────────────────────────────────────────────────────────

export async function BudgetWidget({ scope }: { scope: Scope }) {
  const b = await data.getBudget(scope);
  const remaining = b.income - b.expenses - b.saved;
  return (
    <Card>
      <CardHeader title="Budget this month" icon={<Wallet className={ic} />} href="/budget" />
      {!b.hasData ? (
        <EmptyState compact icon={<Wallet />} title="No transactions yet" description="Add income and expenses to see where the money goes." />
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          {[
            ["Income", b.income],
            ["Spent", b.expenses],
            ["Saved", b.saved],
            ["Remaining", remaining],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-xl bg-sunken/60 p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-display text-lg font-semibold">{formatCents(v as number)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

const HORIZON = { "6m": "6 months", "1y": "1 year", "5y": "5 years", "10y": "10 years", "20y": "20 years", custom: "Custom" } as const;

export async function GoalsWidget({ scope, kind }: { scope: Scope; kind: "savings" | "other" }) {
  const rows = await data.getGoals(scope, kind);
  const savings = kind === "savings";
  return (
    <Card>
      <CardHeader title={savings ? "Savings progress" : "Goals"} icon={savings ? <PiggyBank className={ic} /> : <Target className={ic} />} href="/goals" />
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={savings ? <PiggyBank /> : <Target />}
          title={savings ? "No savings goals" : "No goals yet"}
          description={savings ? "Emergency fund, vacation, farm equipment: track it here." : "Set family and personal goals, from 6 months to 20 years."}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((g) => {
            const cur = savings ? g.currentCents : Number(g.currentValue ?? 0);
            const target = savings ? (g.targetCents ?? 0) : Number(g.targetValue ?? 0);
            return (
              <li key={g.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-medium">{g.name}</span>
                  <span className="shrink-0 text-xs text-muted">{HORIZON[g.horizon]}</span>
                </div>
                {target > 0 ? (
                  <>
                    <ProgressBar value={cur} max={target} label={`${g.name} progress`} />
                    <span className="text-xs text-muted">
                      {savings ? `${formatCents(cur)} of ${formatCents(target)}` : `${cur} of ${target} ${g.unit ?? ""}`}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted">No target set</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─── Personal ────────────────────────────────────────────────────────────────

export async function FitnessWidget({ scope }: { scope: Scope }) {
  const f = await data.getFitness(scope);
  return (
    <Card>
      <CardHeader title="Fitness this week" icon={<Dumbbell className={ic} />} href="/fitness" />
      {f.sessions === 0 ? (
        <EmptyState compact icon={<Dumbbell />} title="No workouts logged" description="Build a weekly plan and log sessions to see progress." />
      ) : (
        <div className="flex gap-6">
          <p>
            <span className="font-display text-3xl font-semibold">{f.sessions}</span>
            <span className="block text-sm text-muted">workouts</span>
          </p>
          <p>
            <span className="font-display text-3xl font-semibold">{f.minutes}</span>
            <span className="block text-sm text-muted">minutes</span>
          </p>
        </div>
      )}
    </Card>
  );
}

export async function JournalWidget({ scope }: { scope: Scope }) {
  const latest = await data.getJournal(scope);
  return (
    <Card className="bg-gradient-to-br from-olive-50 to-surface">
      <CardHeader title="Journal" icon={<NotebookPen className={ic} />} href="/journal" />
      <p className="text-[15px] text-ink-soft">
        {latest
          ? `Last entry ${latest.date === scope.today ? "today" : formatShortDate(latest.date)}${latest.title ? `: “${latest.title}”` : ""}.`
          : "Capture today's moments: private or shared with the family."}
      </p>
      <ButtonLink href="/journal" variant="soft" size="sm" className="mt-4">
        Write today&apos;s entry
      </ButtonLink>
    </Card>
  );
}

export async function ActivityWidget({ scope }: { scope: Scope }) {
  const rows = await data.getActivity(scope);
  return (
    <Card>
      <CardHeader title="Family activity" icon={<Activity className={ic} />} />
      {rows.length === 0 ? (
        <EmptyState compact icon={<Activity />} title="Quiet so far" description="Completed chores, harvests, new recipes and more will show up here." />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <Avatar name={a.actorName ?? "?"} color={a.actorColor} size="sm" />
              <p className="flex-1 pt-1 text-[15px]">
                <span className="font-semibold">{a.actorName ?? "Someone"}</span> {a.summary}
                <span className="ml-2 text-xs text-muted">{relativeTime(a.createdAt)}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Registry: widget id → component. */
export function renderWidget(id: string, scope: Scope, name: string) {
  switch (id) {
    case "today": return <TodayWidget scope={scope} name={name} />;
    case "chores": return <ChoresWidget scope={scope} />;
    case "tasks": return <ChoresWidget scope={scope} kind="task" />;
    case "events": return <EventsWidget scope={scope} />;
    case "weather": return <WeatherWidget scope={scope} />;
    case "announcements": return <AnnouncementsWidget scope={scope} />;
    case "meals": return <MealsWidget scope={scope} />;
    case "shopping": return <ShoppingWidget scope={scope} />;
    case "pantry": return <PantryWidget scope={scope} />;
    case "garden": return <GardenWidget scope={scope} />;
    case "farm": return <FarmWidget scope={scope} />;
    case "budget": return <BudgetWidget scope={scope} />;
    case "savings": return <GoalsWidget scope={scope} kind="savings" />;
    case "goals": return <GoalsWidget scope={scope} kind="other" />;
    case "fitness": return <FitnessWidget scope={scope} />;
    case "journal": return <JournalWidget scope={scope} />;
    case "activity": return <ActivityWidget scope={scope} />;
    case "health": return <HealthWidget scope={scope} />;
    case "pets": return <PetsWidget scope={scope} />;
    case "home": return <HomeUpkeepWidget scope={scope} />;
    case "moon": return <MoonWidget scope={scope} />;
    default: return null;
  }
}
