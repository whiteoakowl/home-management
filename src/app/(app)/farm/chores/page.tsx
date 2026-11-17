import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChoreBoard } from "@/components/house/chore-board";
import { getViewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Farm chores" };

/** Recurring farm work (feeding, watering, eggs, mucking out), governed by Farm access. */
export default async function FarmChoresPage({ searchParams }: PageProps<"/farm/chores">) {
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  return <ChoreBoard viewer={viewer} kind="farm" basePath="/farm/chores" sp={await searchParams} />;
}
