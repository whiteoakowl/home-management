import type { Metadata } from "next";
import Link from "next/link";
import { AreaOff } from "@/components/health/area-off";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { areaHidden } from "@/lib/privacy";
import { articleBySlug, WELLNESS_ARTICLES } from "@/lib/wellness-articles";
import { AFFIRMATIONS, ENCOURAGEMENT, GRATITUDE_PROMPTS, pickForDay } from "@/lib/wellness-insights";

export const metadata: Metadata = { title: "Learn" };

/** Short reads, affirmations, encouragement and gratitude prompts. */
export default async function LearnPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const viewer = await getViewer();
  if (areaHidden(viewer.member, "wellness")) return <AreaOff label="Mental Wellness" />;
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const open = sp.a ? articleBySlug(sp.a) : null;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="My private · Mental Wellness" title="Learn & feel good" description="Short, everyday reads and a little encouragement. General tips, not medical advice." />
      <WellnessTabs active="learn" />
      {open ? (
        <Card className="flex flex-col gap-3">
          <Link href="/wellness/learn" className="text-sm font-medium text-primary-700 hover:underline">
            ← All reads
          </Link>
          <h2 className="text-2xl font-semibold">
            {open.emoji} {open.title}
          </h2>
          <p className="text-sm text-muted">{open.minutes} min read</p>
          {open.body.map((b, i) => (
            <p key={i} className="text-[16px] leading-relaxed text-ink-soft">
              {b}
            </p>
          ))}
          <h3 className="mt-2 font-semibold">Try this</h3>
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            {open.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {WELLNESS_ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link href={`/wellness/learn?a=${a.slug}`} className="flex h-full flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary-300">
                <span className="text-2xl" aria-hidden>
                  {a.emoji}
                </span>
                <span className="font-semibold">{a.title}</span>
                <span className="text-sm text-muted">{a.summary}</span>
                <span className="mt-auto text-xs text-muted">{a.minutes} min read</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader title="Affirmation" />
          <p className="font-display text-lg">“{pickForDay(AFFIRMATIONS, today)}”</p>
        </Card>
        <Card>
          <CardHeader title="Encouragement" />
          <p className="text-[15px]">{pickForDay(ENCOURAGEMENT, today, 3)}</p>
        </Card>
        <Card>
          <CardHeader title="Gratitude prompt" />
          <p className="text-[15px]">{pickForDay(GRATITUDE_PROMPTS, today, 5)}</p>
          <Link href="/wellness/journal?view=gratitude&new=1" className="mt-2 inline-block text-sm font-semibold text-primary-700 hover:underline">
            Write it down →
          </Link>
        </Card>
      </div>
      <WellnessFooter />
    </div>
  );
}
