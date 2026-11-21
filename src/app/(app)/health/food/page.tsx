import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Lock, Pencil, Search, Utensils } from "lucide-react";
import { db } from "@/db";
import { foodJournalEntries, mealPlanEntries, recipes } from "@/db/schema";
import { deleteFoodEntry, logPlannedMeal } from "@/app/actions/food-journal";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { FoodEntryModal } from "@/components/health/food-entry-form";
import { PersonalSwitcher } from "@/components/health/personal-switcher";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { addDays, addMonths, formatLongDate, formatShortDate, monthLabel, startOfMonth, startOfWeek, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { FOOD_MEALS, FULLNESS_LEVELS, HUNGER_LEVELS, mealLabel } from "@/lib/food-journal";
import { AUDIENCE_LABEL, personalSubject, privacyFor } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Food Journal" };

type Entry = typeof foodJournalEntries.$inferSelect;
const VIEWS = ["day", "week", "month", "timeline"] as const;

export default async function FoodJournalPage({ searchParams }: PageProps<"/health/food">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const { subject, subjects, canManage, own } = await personalSubject(viewer, "food", sp.member);
  const today = todayIn(viewer.family.timezone);
  const view = (VIEWS as readonly string[]).includes(String(sp.view)) ? (sp.view as (typeof VIEWS)[number]) : "day";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const href = (o: { view?: string; date?: string; q?: string }) => {
    const p = new URLSearchParams();
    if (!own) p.set("member", subject.id);
    p.set("view", o.view ?? view);
    p.set("date", o.date ?? date);
    if (o.q) p.set("q", o.q);
    return `/health/food?${p}`;
  };
  const range =
    view === "day" ? [date, date] : view === "week" ? [startOfWeek(date), addDays(startOfWeek(date), 6)] : view === "month" ? [startOfMonth(date), addDays(addMonths(startOfMonth(date), 1), -1)] : [addDays(today, -90), today];
  const [entries, privacy, planned] = await Promise.all([
    db
      .select()
      .from(foodJournalEntries)
      .where(and(eq(foodJournalEntries.memberId, subject.id), gte(foodJournalEntries.date, q ? "1900-01-01" : range[0]!), lte(foodJournalEntries.date, range[1]!), q ? or(ilike(foodJournalEntries.food, `%${q}%`), ilike(foodJournalEntries.notes, `%${q}%`)) : undefined))
      .orderBy(desc(foodJournalEntries.date), asc(foodJournalEntries.time), asc(foodJournalEntries.createdAt))
      .limit(400),
    privacyFor(subject.id, "food"),
    view === "day" && canManage && viewer.can("meals")
      ? db
          .select({ e: mealPlanEntries, name: recipes.name })
          .from(mealPlanEntries)
          .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
          .where(and(eq(mealPlanEntries.familyId, viewer.family.id), eq(mealPlanEntries.date, date), or(isNull(mealPlanEntries.ownerMemberId), eq(mealPlanEntries.ownerMemberId, viewer.member.id))))
      : Promise.resolve([]),
  ]);
  const byDate = Map.groupBy(entries, (e) => e.date);
  const logged = new Set(entries.map((e) => e.mealPlanEntryId).filter(Boolean));
  const step = view === "week" ? 7 : 1;
  const prev = view === "month" ? addMonths(startOfMonth(date), -1) : addDays(date, -step);
  const next = view === "month" ? addMonths(startOfMonth(date), 1) : addDays(date, step);
  const title = view === "day" ? (date === today ? "Today" : formatLongDate(date)) : view === "week" ? `Week of ${formatShortDate(range[0]!)}` : view === "month" ? monthLabel(date) : q ? `Results for “${q}”` : "Last 90 days";

  const EntryCard = ({ e }: { e: Entry }) => (
    <li className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
      {e.imageFileId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(e.imageFileId, true)!} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">
          {mealLabel(e.meal ?? e.slot)}
          {e.time ? ` · ${e.time}` : ""}
          {view === "timeline" ? ` · ${formatShortDate(e.date)}` : ""}
        </p>
        <p className="text-[15px] font-medium">{e.food}</p>
        {e.portion && <p className="text-sm text-ink-soft">{e.portion}</p>}
        {(e.hunger || e.fullness) && (
          <p className="text-sm text-muted">
            {[e.hunger ? `Before: ${HUNGER_LEVELS[e.hunger - 1]}` : null, e.fullness ? `After: ${FULLNESS_LEVELS[e.fullness - 1]}` : null].filter(Boolean).join(" · ")}
          </p>
        )}
        {e.feelings.length > 0 && <p className="text-sm text-muted">Felt: {e.feelings.join(", ")}</p>}
        {e.notes && <p className="text-sm text-muted">{e.notes}</p>}
        {e.mealPlanEntryId && <p className="text-xs text-primary-600">From the meal plan</p>}
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center">
          <FoodEntryModal
            memberId={subject.id}
            date={e.date}
            triggerContent={<Pencil className="size-4" aria-label="Edit entry" />}
            defaults={{ id: e.id, date: e.date, time: e.time, meal: e.meal ?? e.slot, food: e.food, portion: e.portion, hunger: e.hunger, fullness: e.fullness, feelings: e.feelings, notes: e.notes, imageUrl: fileUrl(e.imageFileId, true) }}
          />
          <DeleteButton action={deleteFoodEntry} fields={{ id: e.id }} what="this entry" />
        </div>
      )}
    </li>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader help="food-journal"
        eyebrow="My private · Personal Health"
        title={own ? "Food Journal" : `${subject.displayName}'s Food Journal`}
        description="A personal record of what you eat and drink and how you felt. No counting, no rules."
        actions={canManage ? <FoodEntryModal memberId={subject.id} date={view === "day" ? date : today} /> : undefined}
      />
      <PersonalSwitcher subjects={subjects} current={subject.id} base="/health/food" />
      {!own && <p className="rounded-xl bg-mist-50 px-4 py-2.5 text-sm text-mist-700">{subject.displayName} shares this with you. You can view it but not change it.</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks active={view} items={VIEWS.map((v) => ({ key: v, href: href({ view: v }), label: v[0]!.toUpperCase() + v.slice(1) }))} />
        <form action="/health/food" className="flex items-center gap-2">
          {!own && <input type="hidden" name="member" value={subject.id} />}
          <input type="hidden" name="view" value="timeline" />
          <label className="sr-only" htmlFor="food-q">Search food journal</label>
          <input id="food-q" name="q" defaultValue={q} placeholder="Search entries" className="h-10 w-44 rounded-full border border-line-strong bg-surface px-4 text-sm focus:border-primary-500 focus:outline-none" />
          <button type="submit" aria-label="Search" className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface hover:bg-sunken">
            <Search className="size-4" />
          </button>
        </form>
      </div>

      {view !== "timeline" && (
        <div className="flex items-center gap-2">
          <Link href={href({ date: prev })} aria-label="Previous" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronLeft className="size-5" />
          </Link>
          <Link href={href({ date: next })} aria-label="Next" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
            <ChevronRight className="size-5" />
          </Link>
          <h2 className="ml-2 text-xl font-semibold">{title}</h2>
          {date !== today && (
            <Link href={href({ date: today })} className="ml-auto text-sm font-medium text-primary-700 hover:underline">
              Today
            </Link>
          )}
        </div>
      )}
      {view === "timeline" && <h2 className="text-xl font-semibold">{title}</h2>}

      {view === "day" && (
        <div className="grid gap-4 md:grid-cols-2">
          {FOOD_MEALS.map((m) => {
            const list = entries.filter((e) => (e.meal ?? e.slot) === m.key);
            const plan = planned.filter((p) => p.e.slot === m.key && !logged.has(p.e.id));
            if (!list.length && !plan.length && !["breakfast", "lunch", "dinner", "snack"].includes(m.key)) return null;
            return (
              <Card key={m.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{m.label}</h3>
                  {canManage && <FoodEntryModal memberId={subject.id} date={date} defaultMeal={m.key} triggerLabel="Add" />}
                </div>
                {!list.length && !plan.length && <p className="text-sm text-muted">Nothing recorded.</p>}
                <ul className="flex flex-col gap-2">{list.map((e) => <EntryCard key={e.id} e={e} />)}</ul>
                {plan.map((p) => (
                  <ActionButton key={p.e.id} action={logPlannedMeal} fields={{ id: p.e.id, memberId: subject.id }} className="h-10 w-full rounded-lg border border-dashed border-primary-300 text-sm font-medium text-primary-700 hover:bg-primary-50">
                    <Utensils className="size-4" /> I had {p.name ?? p.e.title}
                  </ActionButton>
                ))}
              </Card>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(range[0]!, i)).map((d) => (
            <Link key={d} href={href({ view: "day", date: d })} className={cn("flex min-h-28 flex-col gap-1 rounded-xl border bg-surface p-3 hover:border-primary-300", d === today ? "border-primary-400" : "border-line")}>
              <span className="text-xs font-semibold tracking-wider text-muted uppercase">{new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" })}</span>
              {(byDate.get(d) ?? []).slice(0, 5).map((e) => (
                <span key={e.id} className="truncate text-sm">
                  <span className="text-muted">{mealLabel(e.meal ?? e.slot)}:</span> {e.food}
                </span>
              ))}
              {(byDate.get(d)?.length ?? 0) > 5 && <span className="text-xs text-muted">+{byDate.get(d)!.length - 5} more</span>}
            </Link>
          ))}
        </div>
      )}

      {view === "month" && (
        <Card>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted" aria-hidden>
            {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {(() => {
              const first = startOfMonth(date);
              const pad = new Date(`${first}T12:00:00Z`).getUTCDay();
              const last = range[1]!;
              const cells: (string | null)[] = [...Array(pad).fill(null)];
              for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
              return cells.map((d, i) =>
                d ? (
                  <Link key={d} href={href({ view: "day", date: d })} aria-label={`${formatLongDate(d)}: ${byDate.get(d)?.length ?? 0} entries`} className={cn("flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-sm hover:bg-sunken", d === today && "outline-2 outline-primary-500")}>
                    {Number(d.slice(8))}
                    {byDate.get(d) ? <span className="mt-0.5 rounded-full bg-primary-100 px-1.5 text-[11px] font-semibold text-primary-700">{byDate.get(d)!.length}</span> : null}
                  </Link>
                ) : (
                  <span key={i} />
                ),
              );
            })()}
          </div>
        </Card>
      )}

      {view === "timeline" &&
        (entries.length ? (
          <div className="flex flex-col gap-4">
            {[...byDate.entries()].map(([d, list]) => (
              <section key={d}>
                <Link href={href({ view: "day", date: d })} className="text-sm font-semibold hover:underline">
                  {d === today ? "Today" : formatLongDate(d)}
                </Link>
                <ul className="mt-2 flex flex-col gap-2">{list.map((e) => <EntryCard key={e.id} e={e} />)}</ul>
              </section>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<Utensils />} title={q ? "No matching entries" : "Nothing recorded yet"} description="Your entries will show up here, newest first." />
          </Card>
        ))}

      {own && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Lock className="size-4" aria-hidden /> {AUDIENCE_LABEL[privacy.audience]}. Your food journal never appears on the family dashboard.{" "}
          <Link href="/privacy" className="font-medium text-primary-700 underline">
            Privacy Center
          </Link>
        </p>
      )}
    </div>
  );
}
