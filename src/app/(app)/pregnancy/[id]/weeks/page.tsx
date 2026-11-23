import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { SegmentLinks } from "@/components/ui/tabs";
import { weekContent } from "@/lib/pregnancy/data";
import { trimesterOfWeek, TRIMESTERS } from "@/lib/pregnancy/dates";
import { lengthText, URGENT_NOTE, weightText, WEEKS_COUNT } from "@/lib/pregnancy/weeks";
import { cn } from "@/lib/utils";
import { EducationNote, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Week by week" };

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </Card>
  );
}

export default async function WeeksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string; view?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, g } = ctx;
  const current = g?.week ?? 1;
  const week = Math.min(WEEKS_COUNT, Math.max(1, Number(sp.w) || Math.min(current, WEEKS_COUNT)));
  const view = sp.view === "trimester" ? "trimester" : "week";
  const base = `/pregnancy/${p.id}/weeks`;
  const tri = trimesterOfWeek(week);
  const triWeeks = view === "trimester" ? await Promise.all(Array.from({ length: TRIMESTERS[tri].to - TRIMESTERS[tri].from + 1 }, (_, i) => weekContent(TRIMESTERS[tri].from + i))) : [];
  const w = await weekContent(week);

  return (
    <>
      <PregnancyHeader ctx={ctx} active="weeks" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks active={view} items={[{ key: "week", label: "Week", href: `${base}?w=${week}` }, { key: "trimester", label: "Trimester", href: `${base}?w=${week}&view=trimester` }]} />
        <SegmentLinks active={String(tri)} items={([1, 2, 3] as const).map((t) => ({ key: String(t), label: `Trimester ${t}`, href: `${base}?w=${TRIMESTERS[t].from}&view=${view}` }))} />
      </div>
      <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Weeks">
        {Array.from({ length: WEEKS_COUNT }, (_, i) => i + 1).map((n) => (
          <Link key={n} href={`${base}?w=${n}`} aria-current={n === week ? "page" : undefined} className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ring-1", n === week ? "bg-ink text-white ring-ink" : n === current && g ? "bg-primary-50 text-primary-700 ring-primary-300" : "bg-surface ring-line hover:bg-sunken")}>
            {n}
          </Link>
        ))}
      </nav>

      {view === "trimester" ? (
        <>
          <Card className="mb-4">
            <p className="text-sm font-medium text-primary-600">{TRIMESTERS[tri].weeks}</p>
            <h2 className="text-xl font-semibold">{TRIMESTERS[tri].label}</h2>
            <p className="mt-1 text-sm text-muted">Common symptoms: {w.symptoms.slice(0, 5).join(", ")}.</p>
          </Card>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {triWeeks.map((x) => (
              <li key={x.week}>
                <Link href={`${base}?w=${x.week}`} className={cn("flex h-full gap-3 rounded-[var(--radius-card)] border bg-surface p-4 hover:border-primary-300", x.week === current && g ? "border-primary-400" : "border-line")}>
                  <span className="text-3xl" aria-hidden>
                    {x.emoji}
                  </span>
                  <span>
                    <span className="block font-semibold">Week {x.week}</span>
                    <span className="block text-sm text-muted">Size of {x.size}</span>
                    <span className="mt-1 block text-sm">{x.baby}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex items-center gap-4">
              <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary-50 text-5xl" aria-hidden>
                {w.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary-600">
                  Week {week} · {TRIMESTERS[tri].label}
                  {g && week === current ? " · You're here" : ""}
                </p>
                <h2 className="text-xl font-semibold">About the size of {w.size}</h2>
                <p className="text-sm text-muted">{[lengthText(w.lengthCm), weightText(w.weightG)].filter(Boolean).join(" · ") || "Too small to measure yet"}</p>
              </div>
            </div>
            <p className="mt-3 text-[15px]">{w.baby}</p>
            <div className="mt-4 flex justify-between">
              {week > 1 ? (
                <Link href={`${base}?w=${week - 1}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                  <ChevronLeft className="size-4" /> Week {week - 1}
                </Link>
              ) : (
                <span />
              )}
              {week < WEEKS_COUNT && (
                <Link href={`${base}?w=${week + 1}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                  Week {week + 1} <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Baby's development" />
              <dl className="flex flex-col gap-3 text-[15px]">
                {(
                  [
                    ["body", "Body"],
                    ["organs", "Organs"],
                    ["movement", "Movement"],
                    ["senses", "Senses"],
                  ] as const
                ).map(([k, l]) =>
                  w.development[k] ? (
                    <div key={k}>
                      <dt className="text-sm font-medium text-muted">{l}</dt>
                      <dd>{w.development[k]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </Card>
            <Card>
              <CardHeader title="Your body" />
              <p className="text-[15px]">{w.bodyChanges}</p>
            </Card>
            <List title="Milestones" items={w.milestones} />
            <List title="Common symptoms" items={w.symptoms} />
            <List title="Appointments & tests often offered" items={w.care} />
            <List title="Getting ready" items={w.prepare} />
            <List title="Questions you might ask" items={w.questions} />
          </div>
        </>
      )}
      <EducationNote className="mt-6" />
      <p className="mt-1 text-xs text-muted">{URGENT_NOTE}</p>
    </>
  );
}
