import type { Metadata } from "next";
import Link from "next/link";
import { AreaOff } from "@/components/health/area-off";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { BreathingTimer } from "@/components/wellness/breathing";
import { WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { getViewer } from "@/lib/dal";
import { areaHidden } from "@/lib/privacy";

export const metadata: Metadata = { title: "Breathe" };

export default async function BreathePage() {
  const viewer = await getViewer();
  if (areaHidden(viewer.member, "wellness")) return <AreaOff label="Mental Wellness" />;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader eyebrow="My private · Mental Wellness" title="Breathe" description="A few slow breaths, guided. Stop anytime; breathe normally if you feel lightheaded." />
      <WellnessTabs active="breathe" />
      <Card>
        <BreathingTimer />
      </Card>
      {viewer.can("sounds") && (
        <p className="text-center text-sm text-muted">
          Like calm sound while you breathe? Start something in{" "}
          <Link href="/sounds" className="font-medium text-primary-700 underline">
            Sleep Sounds
          </Link>{" "}
          first; it keeps playing here.
        </p>
      )}
      <WellnessFooter />
    </div>
  );
}
