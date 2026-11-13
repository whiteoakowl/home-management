import { cloneElement } from "react";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { TemplateBoard } from "@/components/house/template-board";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { listChoreTemplates, listOccurrences } from "@/lib/chores";
import { addDays, todayIn } from "@/lib/dates";
import { FREQUENCY_ORDER, frequencyOf } from "@/lib/maintenance-config";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { fmtMoney } from "@/components/records/detail-list";
import { maintViewer } from "../shared";

export const metadata: Metadata = { title: "Maintenance schedule" };

const LABELS: Record<string, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", biannual: "Twice a year", annual: "Annual", custom: "One-time & custom" };

export default async function SchedulePage({ searchParams }: PageProps<"/maintenance/schedule">) {
  const viewer = await maintViewer();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const canEdit = viewer.can("maintenance", "edit");
  const [members, rooms, cats, templates, soon] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "household"),
    listChoreTemplates(viewer, ["maintenance"], today),
    listOccurrences(viewer, { kinds: ["maintenance"], to: addDays(today, 14), statuses: ["pending"] }),
  ]);
  const annual = templates.reduce((s, t) => {
    const per = { weekly: 52, monthly: 12, quarterly: 4, biannual: 2, annual: 1, custom: 1 }[frequencyOf(t.rule).key] ?? 1;
    return s + (t.chore.estimatedCostCents ?? 0) * per;
  }, 0);
  const form = <ChoreFormModal kind="maintenance" members={members} rooms={rooms} categories={cats} defaultOpen={sp.new === "1"} />;
  return (
    <>
      <PageHeader
        eyebrow="Home Maintenance"
        title="Maintenance schedule"
        description={`Preventative upkeep from weekly to annual, with costs and history.${annual ? ` Estimated yearly cost: ${fmtMoney(annual)}.` : ""}`}
        actions={canEdit ? form : undefined}
      />
      <MaintenanceTabs active="schedule" />
      {soon.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Due in the next two weeks</h2>
          <OccurrenceList items={soon} today={today} members={members} canManage={canEdit} />
        </section>
      )}
      <TemplateBoard
        today={today}
        groups={FREQUENCY_ORDER.map((k) => ({ key: k, label: LABELS[k]!, items: templates.filter((t) => frequencyOf(t.rule).key === k) }))}
        empty={
          <Card>
            <EmptyState
              icon={<Wrench />}
              title="No maintenance scheduled"
              description="Track recurring upkeep so nothing gets forgotten. Open any task to see its history and record actual costs."
              example="“Replace HVAC filter”: every 3 months · “Clean gutters”: twice a year"
              action={canEdit ? cloneElement(form, { defaultOpen: false }) : undefined}
            />
          </Card>
        }
      />
    </>
  );
}
