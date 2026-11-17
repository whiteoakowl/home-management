import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { personalSubjects } from "@/lib/privacy";
import { fileUrl } from "@/lib/files";
import { albumPhotos } from "@/lib/photos";
import { PhotoAlbum } from "@/components/photos/photo-album";
import { ProfilePhotoButton } from "@/components/photos/profile-photo";
import { Lock, Settings2, ShieldCheck, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { getFamilyMember, getViewer } from "@/lib/dal";
import { makeScope } from "@/lib/dashboard-data";
import { memberColor } from "@/lib/colors";
import { WIDGETS } from "@/lib/widgets";

export const metadata: Metadata = { title: "Member home" };

/**
 * A member's personal portal ("Serenity's Home"): their chores, events, tasks,
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

  // Personal areas: everything for yourself; for someone else, only what they share with you.
  const q = isSelf ? "" : `?member=${member.id}`;
  const sharedWithMe = isSelf ? null : await Promise.all((["period", "food", "wellness", "fitness"] as const).map(async (c) => [c, (await personalSubjects(viewer, c)).some((x) => x.id === member.id)] as const));
  const can = (c: "period" | "food" | "wellness" | "fitness") => !member.hiddenAreas.includes(c) && (isSelf || !!sharedWithMe?.find(([k, v]) => k === c && v));
  const personalLinks = [
    can("period") && { href: `/health/period${q}`, label: "Period Tracker" },
    can("food") && { href: `/health/food${q}`, label: "Food Journal" },
    can("wellness") && { href: `/wellness${q}`, label: "Mental Wellness" },
    can("fitness") && viewer.can("fitness") && { href: `/fitness${q}`, label: "Fitness" },
    isSelf && viewer.can("goals") && { href: "/goals", label: "Goals" },
    isSelf && viewer.can("journal") && { href: "/journal", label: "Personal Journal" },
    // Own private spaces: only ever linked on your own profile (parents can't open them).
    isSelf && !viewer.isParent && viewer.member.privateInfo && { href: "/house/info?space=mine", label: "My Important Info" },
    isSelf && viewer.member.privateFinance && { href: "/budget?space=mine", label: "My Budget" },
    isSelf && !viewer.isParent && viewer.member.privateProjects && { href: "/maintenance/projects?space=mine", label: "My Home Projects" },
    isSelf && !viewer.isParent && viewer.member.privateVehicles && { href: "/vehicles", label: "My Vehicles" },
    isSelf && { href: "/privacy", label: "Privacy Center" },
  ].filter(Boolean) as { href: string; label: string }[];
  const familyLinks = [
    viewer.can("calendar") && { href: "/calendar", label: "Family Calendar" },
    viewer.can("chores") && { href: "/house/chores", label: "Family Chores" },
    viewer.can("kitchen") && { href: "/kitchen", label: "Family Pantry" },
    viewer.can("recipes") && { href: "/recipes", label: "Family Recipes" },
    viewer.can("meals") && { href: "/meals", label: "Family Meal Plans" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="flex flex-col gap-6">
      <header
        className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        style={{ background: `linear-gradient(120deg, ${c.soft}, var(--color-surface) 70%)` }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={member.displayName} color={member.color} size="xl" photoUrl={fileUrl(member.avatarFileId, true)} />
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
        <div className="flex flex-wrap gap-2">
          {(isSelf || viewer.isParent) && <ProfilePhotoButton memberId={member.id} currentUrl={fileUrl(member.avatarFileId)} />}
          {isSelf && !viewer.isParent && (
            <ButtonLink href="/account" variant="secondary" icon={<Settings2 className="size-4" />}>
              My settings
            </ButtonLink>
          )}
          {viewer.isParent && (
            <ButtonLink href={`/family/${member.id}/manage`} variant="secondary" icon={<Settings2 className="size-4" />}>
              Profile & access
            </ButtonLink>
          )}
        </div>
      </header>
      <nav aria-label={`${first}'s areas`} className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-dashed border-olive-400 bg-olive-50/60 p-4">
          <h2 className="mb-3 flex items-center gap-1.5 font-sans text-xs font-semibold tracking-[0.12em] text-olive-700 uppercase">
            <Lock className="size-3.5" aria-hidden /> {isSelf ? "My private" : `${first}'s private (shared with you)`}
          </h2>
          {personalLinks.length ? (
            <ul className="flex flex-wrap gap-2">
              {personalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex h-10 items-center rounded-full border border-olive-400 bg-surface px-3.5 text-sm font-medium hover:bg-olive-100">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{first} hasn&apos;t shared any personal areas with you.</p>
          )}
        </section>
        <section className="rounded-[var(--radius-card)] border border-primary-200 bg-primary-50/60 p-4">
          <h2 className="mb-3 flex items-center gap-1.5 font-sans text-xs font-semibold tracking-[0.12em] text-primary-700 uppercase">
            <Users className="size-3.5" aria-hidden /> Family
          </h2>
          <ul className="flex flex-wrap gap-2">
            {familyLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex h-10 items-center rounded-full border border-primary-200 bg-surface px-3.5 text-sm font-medium hover:bg-primary-100">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </nav>
      <WidgetGrid widgets={widgets} scope={makeScope(viewer, member.id)} name={first} />
      <PhotoAlbum kind="member" entityId={member.id} photos={await albumPhotos(viewer, "member", member.id)} canAdd={isSelf || viewer.isParent} canRemoveAll={viewer.isParent || isSelf} title={isSelf ? "My photos" : `${first}'s photos`} />
    </div>
  );
}
