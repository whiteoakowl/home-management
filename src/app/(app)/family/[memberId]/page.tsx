import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Settings2, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { getFamilyMember, getViewer } from "@/lib/dal";
import { makeScope } from "@/lib/dashboard-data";
import { memberColor } from "@/lib/colors";
import { WIDGETS } from "@/lib/widgets";

export const metadata: Metadata = { title: "Member home" };

/**
 * A member's personal portal ("Emma's Home"): their chores, events, tasks,
 * goals, fitness and journal. Members can open their own; parents can open anyone's.
 */
export default async function MemberPortalPage({ params }: PageProps<"/family/[memberId]">) {
  const { memberId } = await params;
  const viewer = await getViewer();
  const member = await getFamilyMember(viewer, memberId);
  if (!member || !member.isActive) notFound();
  const isSelf = member.id === viewer.member.id;
  if (!isSelf && !viewer.isParent) notFound();

  const first = member.displayName.split(" ")[0]!;
  const c = memberColor(member.color);
  const widgets = WIDGETS.filter((w) => w.personal && (w.module === null || viewer.can(w.module)))
    .filter((w) => w.id !== "announcements" || isSelf)
    .map((w) => ({ id: w.id, visible: true, size: w.id === "today" ? ("lg" as const) : w.defaultSize }));

  return (
    <div className="flex flex-col gap-6">
      <header
        className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        style={{ background: `linear-gradient(120deg, ${c.soft}, var(--color-surface) 70%)` }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={member.displayName} color={member.color} size="xl" />
          <div>
            <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">{first}&apos;s Home</h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {member.role === "parent" ? (
                <Badge tone="primary">
                  <ShieldCheck className="size-3" aria-hidden /> Parent
                </Badge>
              ) : (
                <Badge>Family member</Badge>
              )}
              {!isSelf && <Badge tone="mist">Viewing as parent</Badge>}
            </div>
          </div>
        </div>
        {viewer.isParent && (
          <ButtonLink href={`/family/${member.id}/manage`} variant="secondary" icon={<Settings2 className="size-4" />}>
            Profile & access
          </ButtonLink>
        )}
      </header>
      <WidgetGrid widgets={widgets} scope={makeScope(viewer, member.id)} name={first} />
    </div>
  );
}
