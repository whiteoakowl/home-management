import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { CalendarHeart, Dumbbell, HeartPulse, Lock, ShieldCheck, Smile, Utensils } from "lucide-react";
import { db } from "@/db";
import { foodJournalEntries, wellnessCheckIns } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { estimate } from "@/lib/cycle";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { healthProfile, periodDaysFor } from "@/lib/personal-health";
import { allPrivacy, AUDIENCE_LABEL, personalSubjects } from "@/lib/privacy";

export const metadata: Metadata = { title: "Personal Health" };

/** My private health hub: period tracker, food journal, wellness, fitness, medical — each private unless shared. */
export default async function PersonalHealthPage() {
  const viewer = await getViewer();
  const today = todayIn(viewer.family.timezone);
  const [profile, privacy, food, checkIn, sharedPeriod, sharedFood, sharedWellness] = await Promise.all([
    healthProfile(viewer.family.id, viewer.member.id),
    allPrivacy(viewer.member.id),
    db.select({ n: count() }).from(foodJournalEntries).where(and(eq(foodJournalEntries.memberId, viewer.member.id), eq(foodJournalEntries.date, today))),
    db.select().from(wellnessCheckIns).where(and(eq(wellnessCheckIns.memberId, viewer.member.id), eq(wellnessCheckIns.date, today))),
    personalSubjects(viewer, "period"),
    personalSubjects(viewer, "food"),
    personalSubjects(viewer, "wellness"),
  ]);
  const est = profile.periodEnabled ? estimate(await periodDaysFor(viewer.member.id), today, { cycle: profile.typicalCycleLength, period: profile.typicalPeriodLength }, { ovulation: profile.periodMode !== "basic" }) : null;
  const hidden = viewer.member.hiddenAreas;
  const tiles = [
    ...(hidden.includes("period") ? [] : [{ href: "/health/period", icon: CalendarHeart, title: "Period Tracker", cat: "period" as const, status: !profile.periodEnabled ? "Not set up yet" : est?.cycleDay ? `Cycle day ${est.cycleDay} · next period around ${est.nextPeriodStart ? formatShortDate(est.nextPeriodStart) : "—"} (estimate)` : "Log your period to begin" }]),
    { href: "/health/food", icon: Utensils, title: "Food Journal", cat: "food" as const, status: food[0]?.n ? `${food[0].n} entr${food[0].n === 1 ? "y" : "ies"} today` : "Nothing recorded today" },
    ...(hidden.includes("wellness") ? [] : [{ href: "/wellness", icon: Smile, title: "Mental Wellness", cat: "wellness" as const, status: checkIn[0] ? "Checked in today" : "Ready for today's check-in?" }]),
    ...(viewer.can("fitness") ? [{ href: "/fitness", icon: Dumbbell, title: "Fitness", cat: "fitness" as const, status: "Workouts, measurements and records" }] : []),
    ...(viewer.can("medical") ? [{ href: `/medical/members/${viewer.member.id}`, icon: HeartPulse, title: "My Medical Information", cat: "medical" as const, status: "Allergies, conditions, medications, documents" }] : []),
  ];
  const sharedWithMe = [
    ...sharedPeriod.filter((s) => s.id !== viewer.member.id).map((s) => ({ ...s, area: "Period Tracker", href: `/health/period?member=${s.id}` })),
    ...sharedFood.filter((s) => s.id !== viewer.member.id).map((s) => ({ ...s, area: "Food Journal", href: `/health/food?member=${s.id}` })),
    ...sharedWellness.filter((s) => s.id !== viewer.member.id).map((s) => ({ ...s, area: "Mental Wellness", href: `/wellness?member=${s.id}` })),
  ];
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="My private" title="Personal Health" description="Your own space for your cycle, food, wellbeing, fitness and medical information. Private unless you choose to share." />
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="group">
            <Card className="flex h-full items-start gap-4 border-dashed border-olive-400 transition-colors group-hover:border-primary-300">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-olive-50 text-olive-700">
                <t.icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">{t.title}</span>
                <span className="text-sm text-ink-soft">{t.status}</span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Lock className="size-3" aria-hidden /> {t.cat === "medical" ? "Each record has its own setting" : AUDIENCE_LABEL[privacy[t.cat].audience]}
                </span>
              </span>
            </Card>
          </Link>
        ))}
        <Link href="/privacy" className="group">
          <Card className="flex h-full items-start gap-4 transition-colors group-hover:border-primary-300">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-semibold">Privacy Center</span>
              <span className="text-sm text-ink-soft">Choose what you share, and with whom.</span>
            </span>
          </Card>
        </Link>
      </div>
      {sharedWithMe.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Shared with me</h2>
          <ul className="flex flex-col gap-2">
            {sharedWithMe.map((s) => (
              <li key={`${s.id}${s.area}`}>
                <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-sunken">
                  <Avatar name={s.displayName} color={s.color} size="sm" />
                  <span className="flex-1 text-sm">
                    {s.displayName}&apos;s {s.area}
                  </span>
                  {s.access === "oversight" && <Badge tone="wine">Parent oversight</Badge>}
                  {s.access === "managed" && <Badge>Managed by parents</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
