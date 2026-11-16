import { EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/display";

/** Shown when parents removed an area (Period Tracker / Mental Wellness) from this profile. */
export function AreaOff({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <EmptyState icon={<EyeOff />} title={`${label} is turned off`} description={`${label} isn't on your profile. A parent can turn it back on in Family → your name → Manage. Nothing you saved was deleted.`} />
      </Card>
    </div>
  );
}
