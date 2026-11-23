import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/display";
import { LinkTabs } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn, utcToZoned } from "@/lib/dates";
import { fmtTime } from "@/lib/dance";
import { STATUS_LABEL } from "@/lib/pregnancy/catalog";
import { canEditPregnancy, currentGestation, getPregnancy, listPregnancies } from "@/lib/pregnancy/data";
import { countdownText, gestationText, TRIMESTERS } from "@/lib/pregnancy/dates";
import { PREGNANCY_FEATURE_LABEL, pregnancyFeature, type PregnancyFeature } from "@/lib/pregnancy/features";
import { EDUCATION_NOTE } from "@/lib/pregnancy/weeks";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Everything a pregnancy page needs. 404s for anyone who may not see it. */
export async function pregnancyContext(id: string) {
  const viewer = await getViewer();
  if (!viewer.can("pregnancy")) notFound();
  const p = await getPregnancy(viewer, id);
  if (!p) notFound();
  const tz = viewer.family.timezone;
  const today = todayIn(tz);
  const nowDate = new Date();
  const local = utcToZoned(nowDate, tz);
  const canEdit = await canEditPregnancy(viewer, p);
  return {
    viewer,
    p,
    tz,
    today,
    now: { date: local.date, time: local.time },
    nowDate,
    g: currentGestation(viewer, p),
    canEdit,
    /** May use (and change) a feature: allowed to edit and the plan includes it. */
    can: (f: PregnancyFeature) => canEdit && pregnancyFeature(viewer, f),
    has: (f: PregnancyFeature) => pregnancyFeature(viewer, f),
  };
}
export type PCtx = Awaited<ReturnType<typeof pregnancyContext>>;

export const clockOf = (d: Date, tz: string) => fmtTime(utcToZoned(d, tz).time);
export const dateOf = (d: Date, tz: string) => utcToZoned(d, tz).date;
export const whenOf = (d: Date, tz: string) => `${formatShortDate(dateOf(d, tz))}, ${clockOf(d, tz)}`;

export const pregnancyTitle = (p: PCtx["p"]) => p.nickname || (p.babyNickname ? `Baby ${p.babyNickname}` : "My pregnancy");

const TABS = [
  ["dashboard", "", "Dashboard"],
  ["weeks", "/weeks", "Week by week"],
  ["appointments", "/appointments", "Appointments"],
  ["health", "/health", "Health"],
  ["care", "/care", "Daily care"],
  ["kicks", "/kicks", "Kicks"],
  ["contractions", "/contractions", "Contractions"],
  ["journal", "/journal", "Journal"],
  ["photos", "/photos", "Photos & docs"],
  ["names", "/names", "Names"],
  ["prepare", "/prepare", "Prepare"],
  ["birth-plan", "/birth-plan", "Birth plan"],
  ["timeline", "/timeline", "Timeline"],
  ["settings", "/settings", "Settings"],
] as const;

export async function PregnancyHeader({ ctx, active }: { ctx: PCtx; active: (typeof TABS)[number][0] }) {
  const { viewer, p, g } = ctx;
  const all = await listPregnancies(viewer);
  const owner = p.memberId !== viewer.member.id ? (await memberOptions(viewer)).find((m) => m.id === p.memberId)?.displayName : null;
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/pregnancy" className="hover:underline">
            Pregnancy Tracker
          </Link>
        }
        title={pregnancyTitle(p)}
        help="pregnancy"
        description={[owner && `${owner}'s pregnancy`, g && p.status !== "born" && `${gestationText(g)} · ${TRIMESTERS[g.trimester].label}`, p.dueDate && `Due ${formatShortDate(p.dueDate)} (estimate)`].filter(Boolean).join(" · ") || undefined}
        actions={p.status !== "active" ? <Badge tone={p.status === "born" ? "olive" : "neutral"}>{STATUS_LABEL[p.status]}</Badge> : undefined}
      />
      {all.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {all.slice(0, 6).map((x) => (
            <Link key={x.id} href={`/pregnancy/${x.id}`} className={cn("rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-line", x.id === p.id ? "bg-primary-600 text-white ring-primary-600" : "bg-surface hover:bg-sunken")}>
              {x.nickname || (x.babyNickname ? `Baby ${x.babyNickname}` : x.dueDate ? `Due ${formatShortDate(x.dueDate)}` : "Pregnancy")}
            </Link>
          ))}
          <Link href="/pregnancy" className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-sunken">
            All pregnancies
          </Link>
        </div>
      )}
      <LinkTabs active={active} tabs={TABS.map(([key, path, label]) => ({ key, href: `/pregnancy/${p.id}${path}`, label }))} />
      {!ctx.canEdit && (
        <p className="mb-4 rounded-2xl border border-line bg-sunken px-4 py-3 text-sm text-muted">
          <Lock className="mr-1.5 inline size-4" aria-hidden />
          You can view this pregnancy. Only the person who&apos;s pregnant (or someone they let edit) can make changes.
        </p>
      )}
    </>
  );
}

/** Progress along 40 weeks (never shown as exact: due dates are estimates). */
export function ProgressVisual({ g, dueDate }: { g: NonNullable<PCtx["g"]>; dueDate: string }) {
  return (
    <div className="flex flex-col gap-2">
      <ProgressBar value={Math.min(100, g.progress)} label={`About ${Math.round(Math.min(100, g.progress))}% of the way to the estimated due date`} />
      <div className="flex justify-between text-xs text-muted">
        <span>Week 1</span>
        <span>13</span>
        <span>27</span>
        <span>40 · {formatShortDate(dueDate)}</span>
      </div>
      <p className="text-sm text-muted">{countdownText(g)}. Due dates are estimates.</p>
    </div>
  );
}

/** A Premium feature on the Free plan: what's saved stays visible; adding needs Premium. */
export function PremiumLocked({ f, isOwner }: { f: PregnancyFeature; isOwner?: boolean }) {
  return (
    <p className="mb-4 rounded-2xl border border-olive-100 bg-olive-50 px-4 py-3 text-sm text-olive-700">
      ✨ {PREGNANCY_FEATURE_LABEL[f]} is part of Premium. Anything already saved stays here to view.{" "}
      {isOwner !== false && (
        <Link href="/settings/billing" className="font-medium underline">
          See plans
        </Link>
      )}
    </p>
  );
}

export function EducationNote({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted", className)}>ℹ️ {EDUCATION_NOTE}</p>;
}
