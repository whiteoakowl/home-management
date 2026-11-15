import { redirect } from "next/navigation";

/** The food journal moved to Personal Health (it's personal, not part of Fitness). */
export default async function OldFoodJournalPage({ searchParams }: PageProps<"/fitness/food">) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  if (typeof sp.member === "string") p.set("member", sp.member);
  if (typeof sp.date === "string") p.set("date", sp.date);
  redirect(`/health/food${p.size ? `?${p}` : ""}`);
}
