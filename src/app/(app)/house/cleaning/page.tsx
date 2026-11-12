import { cloneElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { TemplateBoard } from "@/components/house/template-board";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { listChoreTemplates, listOccurrences } from "@/lib/chores";
import { getViewer } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Cleaning" };

const CADENCES = [
  { key: "daily", label: "Daily", description: "Every day" },
  { key: "weekly", label: "Weekly", description: "Once a week" },
  { key: "monthly", label: "Monthly", description: "Once a month" },
  { key: "seasonal", label: "Seasonal", description: "Four times a year" },
  { key: "biannual", label: "Bi-annual", description: "Spring & fall" },
  { key: "annual", label: "Annual", description: "Once a year" },
  { key: "custom", label: "Custom", description: "Your own schedule" },
];

export default async function CleaningPage({ searchParams }: PageProps<"/house/cleaning">) {
  const viewer = await getViewer();
  if (!viewer.can("house")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const canManage = viewer.can("house", "edit");
  const [members, rooms, cats, templates, thisWeek] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "household"),
    listChoreTemplates(viewer, ["cleaning"], today),
    listOccurrences(viewer, { kinds: ["cleaning"], from: addDays(today, -7), to: addDays(today, 6), statuses: ["pending"] }),
  ]);
  const form = <ChoreFormModal kind="cleaning" members={members} rooms={rooms} categories={cats} defaultOpen={sp.new === "1"} />;

  return (
    <>
      <PageHeader eyebrow="House" title="Cleaning" description="Daily tidy-ups to annual deep cleans, with checklists anyone can follow." actions={canManage ? form : undefined} />
      <HouseTabs active="cleaning" viewer={viewer} />
      {thisWeek.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Due this week</h2>
          <OccurrenceList items={thisWeek} today={today} members={members} canManage={canManage} />
        </section>
      )}
      <TemplateBoard
        today={today}
        groups={CADENCES.map((c) => ({ ...c, items: templates.filter((t) => (t.chore.cleaningCadence ?? "custom") === c.key) }))}
        empty={
          <Card>
            <EmptyState
              icon={<Sparkles />}
              title="No cleaning schedule yet"
              description="Add daily, weekly, seasonal and annual cleaning with checklists, and assign steps to different people."
              example="“Kitchen deep clean”: clean fridge, oven, cabinets, mop floor…"
              action={canManage ? cloneElement(form, { defaultOpen: false }) : undefined}
            />
          </Card>
        }
      />
    </>
  );
}
