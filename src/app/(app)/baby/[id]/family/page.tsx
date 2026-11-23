import type { Metadata } from "next";
import Link from "next/link";
import { BabyLogModal } from "@/components/baby/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui/display";
import { caregivers, logsBetween, logsOfKinds } from "@/lib/baby";
import { BABY_KINDS, type BabyLogKind } from "@/lib/baby-kinds";
import { BabyHeader, babyContext, LogList, memberNames } from "../../shared";

export const metadata: Metadata = { title: "Baby: family & caregivers" };

const LEVEL: Record<string, string> = { edit: "Add & edit everything", use: "Logs and changes their own", add: "Logs and changes their own", view: "View only" };

/** Who helps with the baby, what they can do, who did what, and handoff notes. */
export default async function BabyFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await babyContext(id);
  const { viewer, baby, units, now, canUse, nowDate } = ctx;
  const weekAgo = new Date(nowDate.getTime() - 7 * 86_400_000);
  const [people, notes, week, names] = await Promise.all([caregivers(viewer), logsOfKinds(baby.id, ["caregiver"], 30), logsBetween(baby.id, weekAgo, nowDate), memberNames(viewer)]);
  const byMember = new Map<string, Map<string, number>>();
  for (const l of week) {
    if (!l.createdByMemberId) continue;
    const m = byMember.get(l.createdByMemberId) ?? new Map<string, number>();
    const group = BABY_KINDS[l.kind as BabyLogKind]?.label ?? l.kind;
    m.set(group, (m.get(group) ?? 0) + 1);
    byMember.set(l.createdByMemberId, m);
  }

  return (
    <>
      <BabyHeader ctx={ctx} active="family" />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardHeader title="Caregivers" />
          <ul className="flex flex-col gap-2">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar name={p.name} color={p.color} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-sm text-muted">{p.role === "parent" ? "Parent · everything" : LEVEL[p.level] ?? p.level}</span>
                </span>
                {p.role === "parent" ? <Badge tone="primary">Parent</Badge> : <Badge>{p.level === "view" ? "View" : p.level === "edit" ? "Full" : "Use"}</Badge>}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Everyone here sees the same baby profile and logs, live: what one person logs shows up for the others straight away.</p>
          {viewer.isParent && (
            <Link href="/family" className="text-sm font-semibold text-primary-700 hover:underline">
              Change who can use the Baby tracker →
            </Link>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <CardHeader title="Grandparents & babysitters" />
          <ol className="list-decimal space-y-1 pl-5 text-[15px] text-ink-soft">
            <li>A parent adds them under Family as a member with their own login.</li>
            <li>In their permissions, set Baby tracker to Use (log feeds, diapers, naps) or View.</li>
            <li>Turn off the areas they don&apos;t need, so they only see what helps.</li>
          </ol>
          <p className="text-sm text-muted">Each person&apos;s logs show their name, so you always know who did what. Remove access anytime.</p>
          {viewer.isParent && (
            <Link href="/family/babysitter" className="text-sm font-semibold text-primary-700 hover:underline">
              🖨️ Print a babysitter form (routine, feeding, allergies, care log) →
            </Link>
          )}
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Caregiver notes" action={canUse ? <BabyLogModal babyId={baby.id} kind="caregiver" units={units} now={now} triggerLabel="🤝 Leave a note" /> : undefined} />
          <LogList ctx={ctx} logs={notes} names={names} showDate empty="Handoff notes for the next person: last bottle, teething, what's left to do." />
        </Card>
        <Card>
          <CardHeader title="Who did what (last 7 days)" />
          {byMember.size ? (
            <ul className="flex flex-col gap-3">
              {[...byMember].map(([mid, counts]) => (
                <li key={mid}>
                  <p className="font-medium">{names.get(mid) ?? "Someone"}</p>
                  <p className="text-sm text-muted">{[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing logged this week yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent activity" />
        <LogList ctx={ctx} logs={week.slice(0, 40)} names={names} showDate empty="Nothing logged this week yet." />
      </Card>
    </>
  );
}
