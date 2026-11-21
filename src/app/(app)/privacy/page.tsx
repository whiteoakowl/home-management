import type { Metadata } from "next";
import { familyMembersFor } from "@/lib/names";
import Link from "next/link";
import { Eye, Lock, ShieldAlert } from "lucide-react";
import { PRIVACY_CATEGORIES } from "@/db/schema";
import { PrivacyForm } from "@/components/privacy/privacy-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { allPrivacy, isMinor, PRIVACY_META } from "@/lib/privacy";

export const metadata: Metadata = { title: "Privacy Center" };

const OPTION_LABELS: Partial<Record<(typeof PRIVACY_CATEGORIES)[number], Record<string, string>>> = {
  period: { showOnCalendar: "Show my period days on the calendar (only to me and the people I share with)" },
};

/** Each person controls who can see their personal areas. */
export default async function PrivacyCenterPage() {
  const viewer = await getViewer();
  const [settings, members] = await Promise.all([allPrivacy(viewer.member.id), familyMembersFor(viewer)]);
  const others = members.filter((m) => m.id !== viewer.member.id).map((m) => ({ id: m.id, displayName: m.displayName, color: m.color }));
  const oversight = isMinor(viewer.member, todayIn(viewer.family.timezone)) ? viewer.member.parentAccess : [];
  const areas = PRIVACY_CATEGORIES.filter((c) => !PRIVACY_META[c].perEntry && !viewer.member.hiddenAreas.includes(c));
  const defaults = PRIVACY_CATEGORIES.filter((c) => PRIVACY_META[c].perEntry);
  const row = (c: (typeof PRIVACY_CATEGORIES)[number]) => (
    <Card key={c} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{PRIVACY_META[c].label}</h2>
        <Link href={PRIVACY_META[c].href} className="text-sm font-medium text-primary-700 hover:underline">
          Open
        </Link>
      </div>
      <p className="-mt-2 text-sm text-muted">{PRIVACY_META[c].description}</p>
      {oversight.includes(c) && (
        <p className="flex items-start gap-2 rounded-lg bg-wine-50 px-3 py-2 text-sm text-wine-700">
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden /> Your parents have turned on parent oversight for this area, so they can view it.
        </p>
      )}
      <PrivacyForm category={c} audience={settings[c].audience} memberIds={settings[c].memberIds} members={others} options={settings[c].options} optionLabels={OPTION_LABELS[c]} perEntry={PRIVACY_META[c].perEntry} />
    </Card>
  );
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader help="privacy-overview" eyebrow="My private" title="Privacy Center" description="You decide who can see your personal information. Everything here starts private." />
      <p className="flex items-start gap-2 rounded-xl border border-dashed border-olive-400 bg-olive-50 px-4 py-3 text-sm text-olive-700">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Nothing personal appears on the family dashboard or the family calendar unless you share it here. Family areas (calendar, chores, pantry, recipes, meal plans) are shared with the family as usual.
      </p>
      {oversight.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-wine-50 px-4 py-3 text-sm text-wine-700">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Parent oversight is on for: {oversight.map((c) => PRIVACY_META[c as keyof typeof PRIVACY_META]?.label ?? c).join(", ")}. Your parents can view these areas. Talk to them if you&apos;d like that changed.
        </p>
      )}
      <h2 className="mt-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase">Who can see my areas</h2>
      {areas.map(row)}
      <h2 className="mt-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase">Default for new entries</h2>
      {defaults.map(row)}
    </div>
  );
}
