import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flower2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { buttonClasses } from "@/components/ui/button";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/pregnancy/catalog";
import { currentGestation, listPregnancies } from "@/lib/pregnancy/data";
import { gestationText } from "@/lib/pregnancy/dates";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Pregnancy Tracker" };

/** Every pregnancy the viewer may see. With one active, go straight to it. */
export default async function PregnancyListPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const viewer = await getViewer();
  if (!viewer.can("pregnancy")) notFound();
  const sp = await searchParams;
  const [list, members] = await Promise.all([listPregnancies(viewer), memberOptions(viewer)]);
  const active = list.filter((p) => p.status === "active");
  if (active.length === 1 && !sp.all) redirect(`/pregnancy/${active[0]!.id}`);
  const canAdd = viewer.can("pregnancy", "use");
  const name = new Map(members.map((m) => [m.id, m.displayName]));
  const current = list.filter((p) => p.status === "active" || p.status === "paused");
  const past = list.filter((p) => p.status !== "active" && p.status !== "paused");
  const row = (p: (typeof list)[number]) => {
    const g = currentGestation(viewer, p);
    return (
      <li key={p.id}>
        <Link href={`/pregnancy/${p.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary-300">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-2xl" aria-hidden>
            {p.status === "born" ? "👶" : "🤰"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {p.nickname || (p.babyNickname ? `Baby ${p.babyNickname}` : "Pregnancy")}
              {p.status !== "active" && <Badge>{STATUS_LABEL[p.status]}</Badge>}
            </span>
            <span className="block text-sm text-muted">
              {[p.memberId !== viewer.member.id && name.get(p.memberId), p.status === "active" && g && gestationText(g), p.status === "born" && p.outcome?.date ? `Born ${formatShortDate(p.outcome.date ?? "")}` : p.dueDate && `Due ${formatShortDate(p.dueDate)}`].filter(Boolean).join(" · ")}
            </span>
          </span>
        </Link>
      </li>
    );
  };
  const start = canAdd ? (
    <Link href="/pregnancy/new" className={buttonClasses({})}>
      <Plus className="size-4" /> Start a pregnancy
    </Link>
  ) : undefined;
  return (
    <>
      <PageHeader title="Pregnancy Tracker" help="pregnancy" description="Week by week, appointments, symptoms, kicks, contractions, a journal, names and preparation lists, private by default and shared only with who you choose." actions={list.length ? start : undefined} />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Flower2 />} title="No pregnancies yet" description="Start tracking to see your week, your baby's development, upcoming appointments and more. It's private to you (and the parents) unless you share it." example="Week 24 · about the size of an ear of corn · 112 days to go" action={start} />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {current.length > 0 && <ul className="grid gap-3 sm:grid-cols-2">{current.map(row)}</ul>}
          {past.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted">Past pregnancies</h2>
              <ul className="grid gap-3 sm:grid-cols-2">{past.map(row)}</ul>
            </section>
          )}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">The Pregnancy Tracker is for organizing and remembering, not medical advice. Always follow your healthcare provider&apos;s guidance.</p>
    </>
  );
}
