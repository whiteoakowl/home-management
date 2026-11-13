import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Gift, Pencil, Scale, Trophy, X } from "lucide-react";
import { adjustPoints, cancelRedemption, decideRedemption, deleteReward, requestReward, saveReward } from "@/app/actions/rewards";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, MemberChips, MemberSelect, NumberField, TextField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { memberColor } from "@/lib/colors";
import { getViewer } from "@/lib/dal";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { pointBalances, redemptionsFor, rewardsFor, workShare } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Rewards" };

type Reward = Awaited<ReturnType<typeof rewardsFor>>[number];

function RewardModal({ r, members }: { r?: Reward; members: { id: string; displayName: string; color: string }[] }) {
  return (
    <FormModal
      title={r ? "Edit reward" : "New reward"}
      action={saveReward}
      triggerLabel={r ? "Edit" : "New reward"}
      triggerVariant={r ? "ghost" : "primary"}
      triggerSize={r ? "sm" : "md"}
      triggerIcon={r ? <Pencil className="size-4" /> : undefined}
      size="md"
    >
      {r && <input type="hidden" name="id" value={r.id} />}
      <TextField name="title" label="Reward" defaultValue={r?.title} placeholder="Pick Friday's movie" required />
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField name="cost" label="Points" min={1} defaultValue={r?.cost ?? 50} required />
        <TextField name="emoji" label="Emoji" defaultValue={r?.emoji ?? ""} placeholder="🎬" />
        <NumberField name="cash" label="Cash value ($)" step="0.01" min={0} defaultValue={r?.cashCents ? r.cashCents / 100 : ""} hint="Allowance goes to the budget." />
      </div>
      <TextField name="description" label="Details" defaultValue={r?.description ?? ""} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-soft">Only for (optional)</legend>
        <MemberChips name="forMemberIds" members={members} defaultValue={r?.forMemberIds ?? []} />
      </fieldset>
      {r && (
        <>
          <input type="hidden" name="activeField" value="1" />
          <CheckboxField name="active" label="Available to redeem" defaultChecked={r.active} />
        </>
      )}
    </FormModal>
  );
}

export default async function RewardsPage() {
  const viewer = await getViewer();
  if (!viewer.can("chores")) notFound();
  const today = todayIn(viewer.family.timezone);
  const [members, balances, catalog, history, month, week] = await Promise.all([
    memberOptions(viewer),
    pointBalances(viewer.family.id),
    rewardsFor(viewer),
    redemptionsFor(viewer),
    workShare(viewer.family.id, addDays(today, -30)),
    workShare(viewer.family.id, startOfWeek(today, viewer.family.settings?.weekStartsOn ?? 0)),
  ]);
  const myBalance = balances.get(viewer.member.id)?.balance ?? 0;
  const pending = history.filter((h) => h.r.status === "requested");
  const visible = catalog.filter((r) => viewer.isParent || (r.active && (!r.forMemberIds.length || r.forMemberIds.includes(viewer.member.id))));
  const totalMinutes = month.reduce((s, m) => s + m.minutes, 0);
  return (
    <>
      <PageHeader
        eyebrow="House"
        title="Points & rewards"
        description="Chores earn points. Save them up for rewards the parents set, from screen time to allowance."
        actions={
          viewer.isParent && (
            <>
              <FormModal title="Bonus or deduction" action={adjustPoints} triggerLabel="Adjust points" triggerVariant="secondary" size="sm">
                <MemberSelect name="memberId" label="Who" members={members} placeholder="Choose…" />
                <NumberField name="points" label="Points (negative to deduct)" required />
                <TextField name="reason" label="Why" placeholder="Helped Grandma unpack" required />
              </FormModal>
              <RewardModal members={members} />
            </>
          )
        }
      />
      <HouseTabs active="rewards" viewer={viewer} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {members.map((m) => {
          const b = balances.get(m.id);
          return (
            <Card key={m.id} className={cn("flex items-center gap-3", m.id === viewer.member.id && "ring-2 ring-primary-300")}>
              <Avatar name={m.displayName} color={m.color} />
              <div>
                <p className="text-sm text-muted">{m.displayName}</p>
                <p className="font-display text-2xl font-semibold">{b?.balance ?? 0}</p>
                <p className="text-xs text-muted">{b?.earned ?? 0} earned all-time</p>
              </div>
            </Card>
          );
        })}
      </div>

      {viewer.isParent && pending.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={`Waiting for approval (${pending.length})`} icon={<Gift className="size-4" />} />
          <ul className="divide-y divide-line">
            {pending.map(({ r, name, color }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar name={name} color={color} size="sm" />
                <span className="flex-1">
                  <strong>{name}</strong> wants <strong>{r.title}</strong> <span className="text-muted">· {r.points} pts</span>
                </span>
                <ActionButton action={decideRedemption} fields={{ id: r.id, status: "approved" }} className="h-9 rounded-full bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700">
                  <Check className="size-4" /> Approve
                </ActionButton>
                <ActionButton action={decideRedemption} fields={{ id: r.id, status: "denied" }} className="h-9 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
                  <X className="size-4" /> Not now
                </ActionButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Rewards</h2>
        {visible.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((r) => {
              const can = r.active && myBalance >= r.cost && (!r.forMemberIds.length || r.forMemberIds.includes(viewer.member.id));
              return (
                <article key={r.id} className={cn("flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4", !r.active && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-olive-50 text-2xl" aria-hidden>
                      {r.emoji || "🎁"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-sm text-muted">
                        {r.cost} points{r.cashCents ? ` · ${fmtMoney(r.cashCents)}` : ""}
                        {!r.active && " · hidden"}
                      </p>
                      {r.description && <p className="text-sm text-ink-soft">{r.description}</p>}
                      {r.forMemberIds.length > 0 && <p className="text-xs text-muted">For {r.forMemberIds.map((id) => members.find((m) => m.id === id)?.displayName).join(", ")}</p>}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    {r.active && (
                      can ? (
                        <ActionButton action={requestReward} fields={{ id: r.id }} confirm={`Spend ${r.cost} points on "${r.title}"?`} className="h-9 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">
                          <Gift className="size-4" /> Redeem
                        </ActionButton>
                      ) : (
                        <span className="text-sm text-muted">{myBalance < r.cost ? `${r.cost - myBalance} more points to go` : ""}</span>
                      )
                    )}
                    {viewer.isParent && (
                      <span className="ml-auto flex">
                        <RewardModal r={r} members={members} />
                        <DeleteButton action={deleteReward} fields={{ id: r.id }} what={`"${r.title}"`} />
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<Gift />} title="No rewards yet" description={viewer.isParent ? "Add rewards like screen time, a later bedtime, or allowance." : "Ask a parent to add some rewards."} compact />
          </Card>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="This week's leaderboard" icon={<Trophy className="size-4" />} />
          {week.length ? (
            <ol className="flex flex-col gap-2">
              {week.map((w, i) => (
                <li key={w.memberId} className="flex items-center gap-3">
                  <span className="w-6 text-center font-display text-lg font-semibold text-muted">{i + 1}</span>
                  <Avatar name={w.name} color={w.color} size="sm" />
                  <span className="flex-1 font-medium">{w.name}</span>
                  <span className="text-sm text-muted">{w.done} done</span>
                  <Badge tone="olive">★ {w.points}</Badge>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No chores completed yet this week.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Sharing the load · last 30 days" icon={<Scale className="size-4" />} />
          {month.length ? (
            <>
              <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label={month.map((m) => `${m.name} ${Math.round((m.minutes / totalMinutes) * 100)}%`).join(", ")}>
                {month.map((m) => (
                  <span key={m.memberId} style={{ width: `${(m.minutes / totalMinutes) * 100}%`, backgroundColor: memberColor(m.color).solid }} />
                ))}
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {month.map((m) => (
                  <li key={m.memberId} className="flex items-center gap-2">
                    <Avatar name={m.name} color={m.color} size="xs" />
                    <span className="flex-1">{m.name}</span>
                    <span className="text-muted">
                      {m.done} chores · ~{Math.round(m.minutes / 60)} h · {Math.round((m.minutes / totalMinutes) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Time uses each chore&apos;s estimated minutes (15 if not set).</p>
            </>
          ) : (
            <p className="text-sm text-muted">Complete some chores to see how the work is shared.</p>
          )}
        </Card>
      </div>

      {history.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Redemption history" />
          <ul className="divide-y divide-line text-sm">
            {history.map(({ r, name }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1">
                  {name}: {r.title} <span className="text-muted">· {r.points} pts</span>
                </span>
                <Badge tone={r.status === "approved" ? "primary" : r.status === "denied" ? "neutral" : "olive"}>{r.status === "requested" ? "waiting" : r.status}</Badge>
                <span className="w-24 text-right text-muted">{fmtDate(r.decidedAt ?? r.createdAt.toISOString().slice(0, 10))}</span>
                {r.status === "requested" && (viewer.isParent || r.memberId === viewer.member.id) && (
                  <ActionButton action={cancelRedemption} fields={{ id: r.id }} className="text-sm text-muted underline">
                    Cancel
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
