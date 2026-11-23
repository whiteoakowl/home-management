import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { PregnancyForm } from "@/components/pregnancy/forms";
import { getViewer } from "@/lib/dal";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Start a pregnancy" };

export default async function NewPregnancyPage() {
  const viewer = await getViewer();
  if (!viewer.can("pregnancy", "use")) notFound();
  const members = await memberOptions(viewer);
  return (
    <>
      <PageHeader eyebrow="Pregnancy Tracker" title="Let's get set up" description="Only one date is needed. Everything else is optional and can be changed later in Settings." />
      <Card className="max-w-3xl">
        <PregnancyForm members={members} me={viewer.member.id} isParent={viewer.isParent} />
      </Card>
    </>
  );
}
