import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { MedicalKindPage } from "../kind-page";

export const metadata: Metadata = { title: "Documents · Medical" };

export default async function Page({ searchParams }: PageProps<"/medical/documents">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <MedicalKindPage kind="document" title="Documents" description="Lab results, immunizations, insurance cards, visit summaries and forms, private by default." icon={<FileText />} sp={sp} />;
}
