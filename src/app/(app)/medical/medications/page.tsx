import type { Metadata } from "next";
import { Pill } from "lucide-react";
import { MedicalKindPage } from "../kind-page";

export const metadata: Metadata = { title: "Medications · Medical" };

export default async function Page({ searchParams }: PageProps<"/medical/medications">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <MedicalKindPage kind="medication" title="Medications" description="Prescriptions as prescribed, pharmacies and refill reminders." icon={<Pill />} sp={sp} />;
}
