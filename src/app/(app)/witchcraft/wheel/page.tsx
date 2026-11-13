import type { Metadata } from "next";
import Link from "next/link";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { WheelOfYear } from "@/components/craft/wheel";
import { fmtDate } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { familyUpcomingSabbats, familyWheel, isSouthern } from "@/lib/craft";
import { todayIn } from "@/lib/dates";
import { craftViewer } from "../shared";

export const metadata: Metadata = { title: "Wheel of the Year" };

export default async function WheelPage({ searchParams }: PageProps<"/witchcraft/wheel">) {
  const viewer = await craftViewer();
  const today = todayIn(viewer.family.timezone);
  const sp = (await searchParams) as { year?: string };
  const year = Number(sp.year) >= 1900 && Number(sp.year) <= 2200 ? Number(sp.year) : Number(today.slice(0, 4));
  const [{ wheel }, [next]] = await Promise.all([familyWheel(viewer, year), familyUpcomingSabbats(viewer, today, 1)]);
  return (
    <>
      <PageHeader
        eyebrow="Witchcraft"
        title="Wheel of the Year"
        description={`The eight sabbats${isSouthern(viewer) ? " (southern hemisphere)" : ""}. Solstices and equinoxes are calculated for your time zone; tap a sabbat for its meaning, traditions and your family's plans.`}
      />
      <CraftTabs active="wheel" />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="bg-gradient-to-br from-surface to-primary-50/60">
          <div className="mb-2 flex items-center justify-between text-sm">
            <Link href={`?year=${year - 1}`} className="rounded-full px-3 py-1.5 hover:bg-sunken">
              ← {year - 1}
            </Link>
            <span className="font-display text-lg font-semibold">{year}</span>
            <Link href={`?year=${year + 1}`} className="rounded-full px-3 py-1.5 hover:bg-sunken">
              {year + 1} →
            </Link>
          </div>
          <WheelOfYear items={wheel} next={next && next.date.startsWith(String(year)) ? next.key : undefined} />
        </Card>
        <ul className="flex flex-col gap-3">
          {wheel.map((x) => (
            <li key={x.key}>
              <Link href={`/witchcraft/wheel/${x.key}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
                <span className="text-3xl" aria-hidden>
                  {x.s.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {x.s.name} <Badge tone={x.s.kind === "solar" ? "olive" : "wine"}>{x.s.kind === "solar" ? "Solar" : "Fire festival"}</Badge>
                    {x.overridden && <Badge>Custom date</Badge>}
                    {next?.key === x.key && next.date === x.date && <Badge tone="primary">Next</Badge>}
                  </span>
                  <span className="block text-sm text-muted">{x.s.theme}</span>
                </span>
                <span className="shrink-0 text-sm font-medium">{fmtDate(x.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
