import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { mealPlanEntries, recipes } from "@/db/schema";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { AutoPrint } from "@/components/meals/week-controls";
import { getViewer } from "@/lib/dal";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { canOpenFood, inSpace, resolveSpace, withSpace } from "@/lib/food-space";
import { mealWeekStartsOn } from "@/lib/meal-week";

export const metadata: Metadata = { title: "Meal plan" };

const SLOTS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
] as const;

/** Printable week of meals (Print, or Save as PDF from the print dialog). */
export default async function PrintMealsPage({ searchParams }: PageProps<"/meals/print">) {
  const viewer = await getViewer();
  if (!canOpenFood(viewer, "meals")) notFound();
  const sp = await searchParams;
  const space = await resolveSpace(viewer, sp.space);
  if (space.kind === "family" && !viewer.can("meals")) redirect("/meals/print?space=mine");
  const today = todayIn(viewer.family.timezone);
  const anchor = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today;
  const start = startOfWeek(anchor, mealWeekStartsOn(viewer, space));
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const rows = await db
    .select({ e: mealPlanEntries, name: recipes.name })
    .from(mealPlanEntries)
    .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(and(eq(mealPlanEntries.familyId, viewer.family.id), inSpace(mealPlanEntries.ownerMemberId, space), gte(mealPlanEntries.date, start), lte(mealPlanEntries.date, end)))
    .orderBy(asc(mealPlanEntries.createdAt));
  const slots = SLOTS.filter((s) => s.key !== "snack" || rows.some((r) => r.e.slot === "snack"));
  const at = (d: string, s: string) => rows.filter((r) => r.e.date === d && r.e.slot === s).map((r) => r.name ?? r.e.title ?? "Meal");
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  const title = space.kind === "private" ? (space.own ? "My Meal Plan" : `${space.memberName}'s Meal Plan`) : `The ${viewer.family.name} Family Meal Plan`;
  const auto = sp.auto === "print" || sp.auto === "pdf" ? sp.auto : null;

  return (
    <div className="mx-auto max-w-5xl">
      <AutoPrint when={!!auto} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={withSpace(`/meals?week=${start}`, space)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to meal plans
        </Link>
        <PrintButton label={auto === "pdf" ? "Save as PDF" : "Print"} />
      </div>
      {auto === "pdf" && <p className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 print:hidden">To save a PDF, choose “Save as PDF” as the printer (on iPhone, tap Share → Save to Files).</p>}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 print:border-0 print:p-0">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {fmt(start, { weekday: "long", month: "long", day: "numeric" })} – {fmt(end, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <div className="mt-5 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm print:min-w-0">
            <thead>
              <tr>
                <th className="w-28 border border-line bg-sunken p-2 text-left font-semibold print:bg-transparent">Day</th>
                {slots.map((s) => (
                  <th key={s.key} className="border border-line bg-sunken p-2 text-left font-semibold print:bg-transparent">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d}>
                  <th scope="row" className="border border-line p-2 text-left align-top font-semibold">
                    {fmt(d, { weekday: "long" })}
                    <span className="block text-xs font-normal text-muted">{fmt(d, { month: "short", day: "numeric" })}</span>
                  </th>
                  {slots.map((s) => (
                    <td key={s.key} className="h-16 border border-line p-2 align-top break-words">
                      {at(d, s.key).join(", ")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
