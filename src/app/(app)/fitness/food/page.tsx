import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { db } from "@/db";
import { foodJournalEntries, mealPlanEntries, recipes } from "@/db/schema";
import { deleteFoodEntry, logPlannedMeal } from "@/app/actions/fitness";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { FoodModal } from "@/components/fitness/fitness-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, formatLongDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { fitnessSubject } from "@/lib/fitness";
import { memberOptions } from "@/lib/queries";
import { FitnessNav } from "../fitness-header";

export const metadata: Metadata = { title: "Food journal" };

const SLOTS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
] as const;

export default async function FoodPage({ searchParams }: PageProps<"/fitness/food">) {
  const viewer = await getViewer();
  if (!viewer.can("fitness")) notFound();
  const sp = await searchParams;
  const subject = await fitnessSubject(viewer, sp.member);
  const today = todayIn(viewer.family.timezone);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const [members, entries, planned, week] = await Promise.all([
    memberOptions(viewer),
    db.select().from(foodJournalEntries).where(and(eq(foodJournalEntries.memberId, subject.id), eq(foodJournalEntries.date, date))).orderBy(asc(foodJournalEntries.createdAt)),
    viewer.can("meals")
      ? db
          .select({ e: mealPlanEntries, name: recipes.name })
          .from(mealPlanEntries)
          .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
          .where(and(eq(mealPlanEntries.familyId, viewer.family.id), eq(mealPlanEntries.date, date)))
      : Promise.resolve([]),
    db.select().from(foodJournalEntries).where(and(eq(foodJournalEntries.memberId, subject.id), gte(foodJournalEntries.date, addDays(today, -6)), lte(foodJournalEntries.date, today))).orderBy(desc(foodJournalEntries.date)),
  ]);
  const canEdit = viewer.can("fitness", "edit") && (subject.id === viewer.member.id || viewer.isParent);
  const loggedPlan = new Set(entries.map((e) => e.mealPlanEntryId).filter(Boolean));
  const q = (d: string) => `/fitness/food?member=${subject.id}&date=${d}`;

  return (
    <>
      <PageHeader eyebrow="Personal" title="Food journal" description="A simple record of meals, linked to the family meal plan." actions={canEdit ? <FoodModal memberId={subject.id} date={date} /> : undefined} />
      <FitnessNav active="food" subjectId={subject.id} members={members} isParent={viewer.isParent} />
      <div className="mb-5 flex items-center gap-2">
        <Link href={q(addDays(date, -1))} aria-label="Previous day" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
          <ChevronLeft className="size-5" />
        </Link>
        <Link href={q(addDays(date, 1))} aria-label="Next day" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
          <ChevronRight className="size-5" />
        </Link>
        <h2 className="ml-2 text-xl font-semibold">{date === today ? "Today" : formatLongDate(date)}</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {SLOTS.map((s) => {
            const list = entries.filter((e) => e.slot === s.key);
            const plan = planned.filter((p) => p.e.slot === s.key && !loggedPlan.has(p.e.id));
            return (
              <Card key={s.key}>
                <CardHeader title={s.label} />
                {list.length === 0 && plan.length === 0 && <p className="text-sm text-muted">Nothing logged.</p>}
                <ul className="flex flex-col gap-2">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-start gap-3">
                      {e.imageFileId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(e.imageFileId, true)!} alt="" className="size-12 rounded-lg object-cover" />
                      )}
                      <div className="flex-1">
                        <p className="text-[15px] font-medium">{e.food}</p>
                        {e.notes && <p className="text-sm text-muted">{e.notes}</p>}
                        {e.mealPlanEntryId && <p className="text-xs text-primary-600">From the meal plan</p>}
                      </div>
                      {canEdit && <DeleteButton action={deleteFoodEntry} fields={{ id: e.id }} what="this entry" />}
                    </li>
                  ))}
                </ul>
                {canEdit &&
                  plan.map((p) => (
                    <ActionButton key={p.e.id} action={logPlannedMeal} fields={{ id: p.e.id, memberId: subject.id }} className="mt-2 h-9 w-full rounded-lg border border-dashed border-primary-300 text-sm font-medium text-primary-700 hover:bg-primary-50">
                      <Utensils className="size-4" /> I had {p.name ?? p.e.title}
                    </ActionButton>
                  ))}
              </Card>
            );
          })}
        </div>
        <Card>
          <CardHeader title="Last 7 days" />
          {week.length === 0 ? (
            <EmptyState compact icon={<Utensils />} title="No meals logged" description="Log what you eat to spot patterns: no calorie counting required." />
          ) : (
            <ul className="flex flex-col gap-3">
              {[...Map.groupBy(week, (w) => w.date).entries()].map(([d, list]) => (
                <li key={d}>
                  <Link href={q(d)} className="text-sm font-semibold hover:underline">
                    {d === today ? "Today" : formatLongDate(d)}
                  </Link>
                  <p className="text-sm text-muted">{list.map((x) => x.food).join(" · ")}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
