import type { Metadata } from "next";
import { Stethoscope } from "lucide-react";
import { MedicalKindPage } from "../kind-page";

export const metadata: Metadata = { title: "Conditions · Medical" };

export default async function Page({ searchParams }: PageProps<"/medical/conditions">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <MedicalKindPage kind="condition" title="Conditions" description="Ongoing and past conditions, treating physicians and follow-ups." icon={<Stethoscope />} sp={sp} />;
}
