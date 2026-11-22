import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ListChecks, Lock, MapPin, PartyPopper, Users } from "lucide-react";
import { PartyModal } from "@/components/parties/forms";
import { PlanningTabs } from "@/components/planning/planning-tabs";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { fmtTime } from "@/lib/dance";
import { formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { listParties } from "@/lib/parties";
import { memberOptions } from "@/lib/queries";
import { countdownText, daysUntil } from "@/lib/trips";

export const metadata: Metadata = { title: "Party plans" };

const VIS: Record<string, string> = { private: "Only me", parents: "Parents & me", selected: "Selected people" };

/** Birthday parties and celebrations: upcoming with a countdown, then past ones. */
export default async function PartiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getViewer();
  if (!viewer.can("parties")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const [rows, members] = await Promise.all([listParties(viewer), memberOptions(viewer)]);
  const canAdd = viewer.can("parties", "use");
  const upcoming = rows.filter((r) => !r.p.date || r.p.date >= today);
  const past = rows.filter((r) => !upcoming.includes(r)).reverse();

  const card = (r: (typeof rows)[number]) => {
    const p = r.p;
    const photo = fileUrl(p.imageFileId, true);
    const left = p.date ? daysUntil(today, p.date) : null;
    return (
      <li key={p.id}>
        <Link href={`/parties/${p.id}`} className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] hover:border-primary-300">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-32 w-full object-cover" />
          ) : (
            <div className="flex h-20 items-center justify-center bg-gradient-to-br from-primary-50 to-olive-50 text-primary-600">
              <PartyPopper className="size-8" aria-hidden />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{p.title}</p>
              <Badge tone={left !== null && left >= 0 && left <= 14 ? "olive" : "mist"}>{countdownText(today, p.date, p.date)}</Badge>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {p.date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden /> {formatShortDate(p.date)}
                  {p.startTime ? `, ${fmtTime(p.startTime)}` : ""}
                </span>
              )}
              {p.venue && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {p.venue}
                </span>
              )}
              {p.visibility !== "family" && (
                <span className="inline-flex items-center gap-1">
                  {p.visibility === "selected" ? <Users className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />} {VIS[p.visibility]}
                </span>
              )}
            </p>
            <p className="mt-auto flex flex-wrap gap-x-3 text-sm text-muted">
              {r.invited > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden /> {r.yes} coming · {r.invited} invited
                </span>
              )}
              {r.todos > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="size-3.5" aria-hidden /> {r.todosDone} of {r.todos} done
                </span>
              )}
            </p>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Party plans" description="Birthday parties and celebrations: guest list and RSVPs, a checklist, food, decorations, budget and the day's schedule." actions={canAdd ? <PartyModal members={members} defaultOpen={sp.new === "1"} /> : undefined} />
      <PlanningTabs active="parties" viewer={viewer} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<PartyPopper />} title="No parties planned yet" description="Plan a birthday party with a ready-made checklist, track RSVPs, the menu, decorations and costs, and note gifts for thank-you notes." example="Jack's 8th birthday · Dinosaurs · Mar 14 · 12 coming" />
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{upcoming.map(card)}</ul>}
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">Past parties</h2>
              <ul className="grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3">{past.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
