import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { MedicalKindPage } from "../kind-page";

export const metadata: Metadata = { title: "Allergies · Medical" };

export default async function Page({ searchParams }: PageProps<"/medical/allergies">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <MedicalKindPage kind="allergy" title="Allergies" description="Food, medication, environmental, seasonal and insect allergies. Food allergies flag recipes and meal plans." icon={<TriangleAlert />} sp={sp} />;
}
