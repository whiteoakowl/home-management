import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChoreBoard } from "@/components/house/chore-board";
import { getViewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Tasks" };

/** Tasks work just like chores: today, upcoming, overdue, done, all, mine/everyone, archive. */
export default async function TasksPage({ searchParams }: PageProps<"/house/tasks">) {
  const viewer = await getViewer();
  if (!viewer.can("chores")) notFound();
  return <ChoreBoard viewer={viewer} kind="task" basePath="/house/tasks" sp={await searchParams} />;
}
