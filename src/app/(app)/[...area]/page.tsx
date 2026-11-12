import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { getViewer } from "@/lib/dal";
import { MODULE_META, moduleByHref } from "@/lib/modules";

const PHASE_NAME: Record<number, string> = {
  2: "Household",
  3: "Kitchen",
  4: "Garden & Farm",
  5: "Personal",
  6: "Financial",
  7: "Advanced",
};

function resolve(area: string[]) {
  // Match the longest registered module href, e.g. /house/chores → chores.
  for (let i = area.length; i > 0; i--) {
    const m = moduleByHref(`/${area.slice(0, i).join("/")}`);
    if (m) return m;
  }
  return undefined;
}

export async function generateMetadata({ params }: PageProps<"/[...area]">): Promise<Metadata> {
  const m = resolve((await params).area);
  return { title: m?.label ?? "Not found" };
}

/**
 * Areas scheduled for later build phases. Real routes added in those phases
 * (e.g. app/(app)/calendar/page.tsx) take precedence over this catch-all,
 * so nothing here needs to be torn down later.
 */
export default async function UpcomingAreaPage({ params }: PageProps<"/[...area]">) {
  const { area } = await params;
  const meta = resolve(area);
  if (!meta) notFound();
  const viewer = await getViewer();
  if (!viewer.can(meta.id)) notFound();

  const related = Object.values(MODULE_META).filter((m) => m.phase === meta.phase && m.id !== meta.id && viewer.can(m.id));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={meta.group} title={meta.label} description={meta.tagline} />
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-gradient-to-br from-primary-100 to-olive-100 opacity-70" aria-hidden />
        <div className="relative flex flex-col gap-5">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <Icon name={meta.icon} className="size-7" />
          </span>
          <div className="flex flex-col gap-2">
            <Badge tone="primary" className="w-fit">
              <Sparkles className="size-3" aria-hidden /> Coming in Phase {meta.phase}: {PHASE_NAME[meta.phase]}
            </Badge>
            <h2 className="text-2xl font-semibold">{meta.label} is being built</h2>
            <p className="text-[15px] text-muted">
              The data model for {meta.label.toLowerCase()} is already in place. Here&apos;s what this area will do:
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {meta.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2.5 text-[15px]">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {h}
              </li>
            ))}
          </ul>
          {related.length > 0 && (
            <p className="text-sm text-muted">Arriving alongside: {related.map((r) => r.label).join(", ")}.</p>
          )}
          <ButtonLink href="/" variant="soft" className="w-fit">
            Back to home
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
