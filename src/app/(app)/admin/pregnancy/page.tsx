import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/app/actions/admin";
import { WeekContentForm } from "@/components/pregnancy/forms";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { allWeekOverrides } from "@/lib/pregnancy/data";
import { PREGNANCY_FEATURE_LABEL, PREGNANCY_FEATURES } from "@/lib/pregnancy/features";
import { builtInWeek, WEEKS_COUNT } from "@/lib/pregnancy/weeks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pregnancy content" };

/** Platform admin only (404 for everyone else): edit the week-by-week educational content. */
export default async function AdminPregnancyContent({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const week = Math.min(WEEKS_COUNT, Math.max(1, Number(sp.w) || 1));
  const overrides = await allWeekOverrides();
  const edited = new Set(overrides.map((o) => o.week));
  const row = overrides.find((o) => o.week === week);
  return (
    <>
      <PageHeader eyebrow={<Link href="/admin">Admin</Link>} title="Pregnancy content" description="Override any week's educational text. Blank fields keep the built-in content. Changes apply to every family right away." />
      <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Weeks">
        {Array.from({ length: WEEKS_COUNT }, (_, i) => i + 1).map((n) => (
          <Link key={n} href={`?w=${n}`} aria-current={n === week ? "page" : undefined} className={cn("relative flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ring-1", n === week ? "bg-ink text-white ring-ink" : "bg-surface ring-line hover:bg-sunken")}>
            {n}
            {edited.has(n) && <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-olive-500" aria-label="edited" />}
          </Link>
        ))}
      </nav>
      <Card className="mb-6 max-w-4xl">
        <h2 className="mb-3 font-semibold">
          Week {week}
          {row ? <span className="ml-2 text-sm font-normal text-muted">edited {row.updatedAt.toISOString().slice(0, 10)}</span> : null}
        </h2>
        <WeekContentForm key={week} week={week} base={builtInWeek(week)} override={row?.data ?? null} />
      </Card>
      <Card className="max-w-4xl">
        <h2 className="mb-2 font-semibold">Free and Premium features</h2>
        <p className="mb-3 text-sm text-muted">Set in src/lib/pregnancy/features.ts. Prices come from the subscription settings, never from here.</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(PREGNANCY_FEATURES).map(([k, v]) => (
            <li key={k} className="flex justify-between rounded-lg bg-sunken px-3 py-1.5">
              <span>{PREGNANCY_FEATURE_LABEL[k as keyof typeof PREGNANCY_FEATURES]}</span>
              <span className={v === "premium" ? "font-medium text-olive-700" : "text-muted"}>{v === "premium" ? "Premium" : "Free"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
