import { cloneElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wrench } from "lucide-react";
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

export const metadata: Metadata = { title: "Maintenance" };

/** Season of the next occurrence (northern hemisphere). */
function season(date: string | null) {
  if (!date) return "unscheduled";
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "fall" : "winter";
}

export default async function MaintenancePage({ searchParams }: PageProps<"/house/maintenance">) {
  const viewer = await getViewer();
  if (!viewer.can("house")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const canManage = viewer.can("house", "edit");
  const [members, rooms, cats, templates, soon] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "household"),
    listChoreTemplates(viewer, ["maintenance"], today),
    listOccurrences(viewer, { kinds: ["maintenance"], to: addDays(today, 14), statuses: ["pending"] }),
  ]);
  const form = <ChoreFormModal kind="maintenance" members={members} rooms={rooms} categories={cats} defaultOpen={sp.new === "1"} />;
  return (
    <>
      <PageHeader eyebrow="House" title="Maintenance" description="Recurring upkeep and seasonal tasks: filters, gutters, smoke detectors, and more." actions={canManage ? form : undefined} />
      <HouseTabs active="maintenance" viewer={viewer} />
      {soon.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Due in the next two weeks</h2>
          <OccurrenceList items={soon} today={today} members={members} canManage={canManage} />
        </section>
      )}
      <TemplateBoard
        today={today}
        groups={["spring", "summer", "fall", "winter", "unscheduled"].map((s) => ({
          key: s,
          label: s === "unscheduled" ? "Not scheduled" : s[0]!.toUpperCase() + s.slice(1),
          items: templates.filter((t) => season(t.nextDue) === s),
        }))}
        empty={
          <Card>
            <EmptyState
              icon={<Wrench />}
              title="No maintenance tasks yet"
              description="Track recurring upkeep so nothing gets forgotten."
              example="“Replace HVAC filter”: every 3 months · “Clean gutters”: spring & fall"
              action={canManage ? cloneElement(form, { defaultOpen: false }) : undefined}
            />
          </Card>
        }
      />
    </>
  );
}
