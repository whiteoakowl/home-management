import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pause, Pencil, Play, Trash2, Trophy } from "lucide-react";
import { deleteContribution, deleteGoal, deleteMilestone, setGoalStatus, toggleMilestone } from "@/app/actions/goals";
import { LineChart } from "@/components/charts";
import { ActionButton, CheckCircle, DeleteButton } from "@/components/forms/inline";
import { ContributeModal, GoalFormModal, MilestoneModal } from "@/components/goals/goal-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, ProgressRing } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { getGoal, HORIZONS, progressOf, projectedDate } from "@/lib/goals";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Goal" };

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.can("goals")) notFound();
  const data = await getGoal(viewer, id);
  if (!data) notFound();
  const { g, owner, milestones, contributions } = data;
  const today = todayIn(viewer.family.timezone);
  const p = progressOf(g);
  const eta = projectedDate(today, p.monthsLeft);
  const canEdit = viewer.can("goals", "edit") && (viewer.isParent || !g.ownerMemberId || g.ownerMemberId === viewer.member.id);
  const [members, access] = await Promise.all([memberOptions(viewer), getRecordAccess("goal", [id])]);
  const fmt = (n: number) => (p.money ? formatCents(n * 100) : `${Math.round(n * 100) / 100} ${g.unit ?? ""}`);
  // Cumulative progress over time.
  const chrono = [...contributions].reverse();
  const amountOf = (c: (typeof chrono)[number]) => (p.money ? (c.c.amountCents ?? 0) / 100 : Number(c.c.value ?? 0));
  const startValue = p.current - chrono.reduce((s, c) => s + amountOf(c), 0);
  const series = chrono.map((c, i) => ({
    label: formatShortDate(c.c.date),
    value: Math.round((startValue + chrono.slice(0, i + 1).reduce((s, x) => s + amountOf(x), 0)) * 100) / 100,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/goals" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Goals
      </Link>
      <PageHeader
        eyebrow={`${HORIZONS.find((h) => h.key === g.horizon)?.label ?? ""} · ${owner ?? "Family"} · ${g.kind}`}
        title={g.name}
        description={g.description ?? undefined}
        actions={
          canEdit ? (
            <>
              {g.status === "active" && <ContributeModal goalId={g.id} money={p.money} unit={g.unit} />}
              <GoalFormModal
                members={members}
                me={viewer.member.id}
                isParent={viewer.isParent}
                triggerContent={<><Pencil className="size-4" /> Edit</>}
                defaults={{ id: g.id, name: g.name, description: g.description, kind: g.kind, horizon: g.horizon, ownerMemberId: g.ownerMemberId, target: p.target || null, monthly: p.monthly || null, unit: g.unit, targetDate: g.targetDate, notes: g.notes, visibility: g.visibility, sharedWith: access.get(id) ?? [] }}
              />
              {g.status === "active" ? (
                <ActionButton action={setGoalStatus} fields={{ id, status: "paused" }} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                  <Pause className="size-4" /> Pause
                </ActionButton>
              ) : (
                <ActionButton action={setGoalStatus} fields={{ id, status: "active" }} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                  <Play className="size-4" /> Resume
                </ActionButton>
              )}
              {g.status !== "achieved" && (
                <ActionButton action={setGoalStatus} fields={{ id, status: "achieved" }} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                  <Trophy className="size-4" /> Mark achieved
                </ActionButton>
              )}
              <ActionButton action={deleteGoal} fields={{ id }} confirm="Delete this goal and its history?" label="Delete goal" className="size-9 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                <Trash2 className="size-4" />
              </ActionButton>
            </>
          ) : undefined
        }
      />
      {g.status === "achieved" && (
        <div className="rounded-[var(--radius-card)] border border-primary-200 bg-gradient-to-r from-primary-50 to-olive-50 px-5 py-4 text-[15px] text-primary-800">
          <strong>Goal achieved! 🎉</strong> Way to go.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5">
          <ProgressRing value={p.current} max={Math.max(p.target, 0.0001)} size={120}>
            <span className="text-lg">{Math.round(p.pct)}%</span>
          </ProgressRing>
          <div>
            <p className="font-display text-3xl font-semibold">{fmt(p.current)}</p>
            <p className="text-muted">{p.target ? `of ${fmt(p.target)}` : "No target set"}</p>
          </div>
        </Card>
        <Card className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Remaining</p>
            <p className="font-display text-xl font-semibold">{fmt(p.remaining)}</p>
          </div>
          {p.money && (
            <div>
              <p className="text-sm text-muted">Monthly</p>
              <p className="font-display text-xl font-semibold">{p.monthly ? formatCents(p.monthly * 100) : "—"}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted">{eta ? "Projected" : "Target date"}</p>
            <p className="font-display text-xl font-semibold">{eta ? formatShortDate(eta) : g.targetDate ? formatShortDate(g.targetDate) : "—"}</p>
            {eta && g.targetDate && <p className="text-xs text-muted">{eta <= g.targetDate ? "Ahead of target ✓" : "Behind target"}</p>}
          </div>
        </Card>
      </div>
      {series.length > 1 && (
        <Card>
          <CardHeader title="Progress over time" />
          <LineChart data={series} label={`${g.name} progress`} seriesName={p.money ? "Saved" : "Progress"} valueFormat={p.money ? { currency: true } : { suffix: g.unit ?? "" }} />
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Milestones" action={canEdit ? <MilestoneModal goalId={g.id} money={p.money} /> : undefined} />
          {milestones.length === 0 ? (
            <p className="text-sm text-muted">Break the goal into smaller wins.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  {canEdit ? <CheckCircle action={toggleMilestone} id={m.id} done={!!m.achievedAt} label={m.title} size="sm" /> : <span className="size-6" />}
                  <span className={m.achievedAt ? "flex-1 text-muted line-through" : "flex-1"}>{m.title}</span>
                  {(m.targetCents !== null || m.targetValue !== null) && <Badge>{p.money ? formatCents(m.targetCents ?? 0) : `${Number(m.targetValue)} ${g.unit ?? ""}`}</Badge>}
                  {m.dueOn && <span className="text-xs text-muted">{formatShortDate(m.dueOn)}</span>}
                  {canEdit && <DeleteButton action={deleteMilestone} fields={{ id: m.id }} what="milestone" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={p.money ? "Contributions" : "Progress log"} />
          {contributions.length === 0 ? (
            <EmptyState compact icon={<Trophy />} title="Nothing logged yet" description={p.money ? "Add money as you save it." : "Log progress as you go."} />
          ) : (
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {contributions.map(({ c, who }) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-sm text-muted">{formatShortDate(c.date)}</span>
                  <span className="flex-1 truncate">{c.notes ?? who}</span>
                  <span className="font-semibold tabular-nums">+{p.money ? formatCents(c.amountCents ?? 0) : `${Number(c.value)} ${g.unit ?? ""}`}</span>
                  {canEdit && <DeleteButton action={deleteContribution} fields={{ id: c.id }} what="this entry" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {g.notes && <p className="text-[15px] text-ink-soft">{g.notes}</p>}
    </div>
  );
}
