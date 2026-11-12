import { cloneElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { listOccurrences } from "@/lib/chores";
import { getViewer } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/house/tasks">) {
  const viewer = await getViewer();
  if (!viewer.can("chores")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const canManage = viewer.can("chores", "edit");
  const show = sp.show === "done" ? "done" : "open";
  const who = typeof sp.who === "string" ? sp.who : "everyone";
  const [members, rooms, cats, tasks] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "chore"),
    listOccurrences(viewer, {
      kinds: ["task"],
      statuses: show === "done" ? ["done"] : ["pending", "missed"],
      from: show === "done" ? addDays(today, -60) : undefined,
      to: show === "done" ? today : addDays(today, 60),
      order: show === "done" ? "desc" : "asc",
      assigneeId: who === "mine" ? viewer.member.id : undefined,
    }),
  ]);
  const form = <ChoreFormModal kind="task" members={members} rooms={rooms} categories={cats} defaultOpen={sp.new === "task"} />;
  const q = (p: Record<string, string>) => `/house/tasks?${new URLSearchParams({ show, who, ...p })}`;
  return (
    <>
      <PageHeader eyebrow="House" title="Tasks" description="One-off jobs with a due date: errands, calls, fix-its." actions={canManage ? form : undefined} />
      <HouseTabs active="tasks" viewer={viewer} />
      <div className="mb-5 flex flex-wrap gap-2">
        <SegmentLinks active={show} items={[{ key: "open", href: q({ show: "open" }), label: "Open" }, { key: "done", href: q({ show: "done" }), label: "Completed" }]} />
        <SegmentLinks active={who} items={[{ key: "everyone", href: q({ who: "everyone" }), label: "Everyone" }, { key: "mine", href: q({ who: "mine" }), label: "Mine" }]} />
      </div>
      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck />}
            title={show === "done" ? "No completed tasks yet" : "No open tasks"}
            description="Tasks are one-time jobs. Give them a due date and an owner."
            example="“Schedule furnace inspection”, due Friday, Dad"
            action={canManage && show === "open" ? cloneElement(form, { defaultOpen: false }) : undefined}
          />
        </Card>
      ) : (
        <OccurrenceList items={tasks} today={today} members={members} canManage={canManage} showAssignee={who !== "mine"} />
      )}
    </>
  );
}
