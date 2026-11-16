import { newEntryVisibility } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PiggyBank, Target, Trophy } from "lucide-react";
import { GoalFormModal } from "@/components/goals/goal-forms";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { HORIZONS, listGoals, progressOf, projectedDate } from "@/lib/goals";
import { memberOptions } from "@/lib/queries";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage({ searchParams }: PageProps<"/goals">) {
  const viewer = await getViewer();
  if (!viewer.can("goals")) notFound();
  const sp = await searchParams;
  // Family: family-wide goals + everyone else's personal goals. Personal / Savings / Fitness: only your own.
  const TABS = ["family", "personal", "savings", "fitness", "all"] as const;
  const kind = TABS.includes(sp.kind as (typeof TABS)[number]) ? (sp.kind as (typeof TABS)[number]) : "family";
  const today = todayIn(viewer.family.timezone);
  const [members, everything, initialVisibility] = await Promise.all([memberOptions(viewer), listGoals(viewer), newEntryVisibility(viewer.member.id, "goals")]);
  const rows =
    kind === "all"
      ? everything
      : kind === "family"
        ? everything.filter((r) => r.g.ownerMemberId !== viewer.member.id)
        : everything.filter((r) => r.g.ownerMemberId === viewer.member.id && r.g.kind === kind);
  const active = rows.filter((r) => r.g.status === "active" || r.g.status === "paused");
  const done = rows.filter((r) => r.g.status === "achieved");
  const saved = rows.filter((r) => r.g.kind === "savings").reduce((s, r) => s + r.g.currentCents, 0);
  const emptyCopy = {
    family: { title: "No family goals yet", description: "Family goals and everyone's shared personal goals show here." },
    personal: { title: "No personal goals yet", description: "Your personal goals. Others see them in their Family section; only you see this list." },
    savings: { title: "No savings goals yet", description: "Your savings goals are private to you. Nobody else in the family sees them." },
    fitness: { title: "No fitness goals yet", description: "Your own fitness goals." },
    all: { title: "No goals yet", description: "Set savings and family goals with milestones and watch the progress bars fill up." },
  }[kind];
  const add = <GoalFormModal initialVisibility={initialVisibility} members={members} me={viewer.member.id} isParent={viewer.isParent} defaultOpen={sp.new === "1"} />;
  const canEdit = viewer.can("goals", "edit");

  return (
    <>
      <PageHeader title="Goals & savings" description="What your family is working toward, from six months to twenty years out." actions={canEdit ? add : undefined} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Target className="size-4" /> Active goals
          </p>
          <p className="font-display text-3xl font-semibold">{active.length}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <PiggyBank className="size-4" /> Saved toward goals
          </p>
          <p className="font-display text-3xl font-semibold">{formatCents(saved)}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Trophy className="size-4" /> Achieved
          </p>
          <p className="font-display text-3xl font-semibold">{done.length}</p>
        </Card>
      </div>
      <div className="mb-6">
        <SegmentLinks
          active={kind}
          items={[
            { key: "family", href: "/goals", label: "Family" },
            { key: "personal", href: "/goals?kind=personal", label: "My personal" },
            { key: "savings", href: "/goals?kind=savings", label: "My savings" },
            { key: "fitness", href: "/goals?kind=fitness", label: "My fitness" },
            { key: "all", href: "/goals?kind=all", label: "All" },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Target />} title={emptyCopy.title} description={emptyCopy.description} example="Emergency fund · Vacation · Vehicle · Education · Farm equipment · Retirement" action={canEdit ? <GoalFormModal initialVisibility={initialVisibility} members={members} me={viewer.member.id} isParent={viewer.isParent} /> : undefined} />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {HORIZONS.map((h) => {
            const list = active.filter((r) => r.g.horizon === h.key);
            if (!list.length) return null;
            return (
              <section key={h.key}>
                <h2 className="mb-3 text-xl font-semibold">{h.key === "custom" ? "Other goals" : `${h.label} goals`}</h2>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {list.map(({ g, owner, ownerColor }) => {
                    const p = progressOf(g);
                    const eta = projectedDate(today, p.monthsLeft);
                    return (
                      <li key={g.id}>
                        <Link href={`/goals/${g.id}`} className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-primary-300">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-display text-lg font-semibold">{g.name}</p>
                              <p className="text-sm text-muted capitalize">{g.kind === "savings" ? "Savings" : `${g.kind} goal`}</p>
                            </div>
                            {owner ? <Avatar name={owner} color={ownerColor} size="sm" /> : <Badge tone="primary">Family</Badge>}
                          </div>
                          {p.target > 0 ? (
                            <>
                              <ProgressBar value={p.current} max={p.target} label={`${g.name} progress`} tone={g.status === "paused" ? "olive" : "primary"} />
                              <p className="flex justify-between text-sm">
                                <span className="font-semibold">{p.money ? formatCents(p.current * 100) : `${p.current} ${g.unit ?? ""}`}</span>
                                <span className="text-muted">of {p.money ? formatCents(p.target * 100) : `${p.target} ${g.unit ?? ""}`}</span>
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted">No target set</p>
                          )}
                          <p className="mt-auto text-xs text-muted">
                            {g.status === "paused" ? "Paused" : eta ? `On track for ${formatShortDate(eta)} at ${formatCents(p.monthly * 100)}/mo` : g.targetDate ? `Target ${formatShortDate(g.targetDate)}` : ""}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">Achieved 🎉</h2>
              <ul className="flex flex-wrap gap-2">
                {done.map(({ g }) => (
                  <li key={g.id}>
                    <Link href={`/goals/${g.id}`} className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700">
                      <Trophy className="size-4" /> {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
