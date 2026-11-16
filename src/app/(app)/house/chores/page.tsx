import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChoreBoard } from "@/components/house/chore-board";
import { getViewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Chores" };

export default async function ChoresPage({ searchParams }: PageProps<"/house/chores">) {
  const viewer = await getViewer();
  if (!viewer.can("chores")) notFound();
  return <ChoreBoard viewer={viewer} kind="chore" basePath="/house/chores" sp={await searchParams} />;
}
