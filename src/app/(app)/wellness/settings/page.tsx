import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { WellnessSettingsForm } from "@/components/wellness/forms";
import { WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { AreaOff } from "@/components/health/area-off";
import { getViewer } from "@/lib/dal";
import { areaHidden } from "@/lib/privacy";
import { healthProfile } from "@/lib/personal-health";

export const metadata: Metadata = { title: "Wellness settings" };

export default async function WellnessSettingsPage() {
  const viewer = await getViewer();
  if (areaHidden(viewer.member, "wellness")) return <AreaOff label="Mental Wellness" />;
  const profile = await healthProfile(viewer.family.id, viewer.member.id);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader eyebrow="My private · Mental Wellness" title="Settings" description="Reminders, your own feelings and self-care activities, and quote topics." />
      <WellnessTabs active="settings" />
      <Card>
        <WellnessSettingsForm reminders={profile.reminders} customFeelings={profile.customFeelings} customSelfCare={profile.customSelfCare} quoteCategories={profile.quoteCategories} />
      </Card>
      <p className="text-sm text-muted">
        Who can see your wellness check-ins, journal and goals is set in the{" "}
        <Link href="/privacy" className="font-medium text-primary-700 underline">
          Privacy Center
        </Link>
        .
      </p>
      <WellnessFooter />
    </div>
  );
}
