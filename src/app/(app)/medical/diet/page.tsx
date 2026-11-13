import type { Metadata } from "next";
import { Salad } from "lucide-react";
import { MedicalKindPage } from "../kind-page";

export const metadata: Metadata = { title: "Food restrictions · Medical" };

export default async function Page({ searchParams }: PageProps<"/medical/diet">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <MedicalKindPage kind="restriction" title="Food restrictions" description="Intolerances, restricted foods and preferences, checked against every recipe and meal plan." icon={<Salad />} sp={sp} />;
}
