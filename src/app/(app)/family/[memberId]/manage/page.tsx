import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserMinus } from "lucide-react";
import { removeMember } from "@/app/actions/family";
import { EditMemberForm } from "@/components/family/member-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { MODULES } from "@/db/schema/_shared";
import { getFamilyMember, requireParent } from "@/lib/dal";
import { getStoredPermissions } from "@/lib/family";
import { HiddenAreasForm, LoginForm, ParentAccessForm, PermissionsForm, PrivateFoodForm } from "./forms";
import { healthProfile } from "@/lib/personal-health";
import { todayIn } from "@/lib/dates";
import { HIDEABLE_AREAS, isMinor, PRIVACY_META } from "@/lib/privacy";
import { PRIVACY_CATEGORIES } from "@/db/schema";
import { MemberEmailForm, ResetPasswordForm } from "../../../account/forms";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Profile & access" };

export default async function ManageMemberPage({ params }: PageProps<"/family/[memberId]/manage">) {
  const { memberId } = await params;
  const viewer = await requireParent().catch(() => notFound());
  const member = await getFamilyMember(viewer, memberId);
  if (!member || !member.isActive) notFound();

  const isOwner = member.id === viewer.family.ownerMemberId;
  const stored = (await getStoredPermissions([member.id])).get(member.id) ?? {};
  const modules = MODULES.filter((m) => viewer.family.enabledModules.includes(m));
  const loginEmail = member.userId ? (await db.select({ email: users.email }).from(users).where(eq(users.id, member.userId)))[0]?.email : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/family/${member.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {member.displayName}&apos;s home
      </Link>
      <PageHeader title={`${member.displayName}: profile & access`} />

      <Card>
        <CardHeader title="Profile" />
        <EditMemberForm
          member={{ id: member.id, displayName: member.displayName, role: member.role, color: member.color, birthday: member.birthday }}
          isOwner={isOwner}
        />
      </Card>

      <Card>
        <CardHeader title="What they can access" />
        {member.role === "parent" ? (
          <p className="text-[15px] text-muted">Parents have full access to every area. Change their role to Family member to limit access.</p>
        ) : (
          <PermissionsForm
            member={{ id: member.id, displayName: member.displayName, color: member.color, access: stored }}
            modules={modules}
            personal={{ period: member.hiddenAreas.includes("period") ? "hide" : (await healthProfile(viewer.family.id, member.id)).periodMode, wellness: !member.hiddenAreas.includes("wellness"), finance: member.privateFinance, info: member.privateInfo, projects: member.privateProjects }}
          />
        )}
      </Card>

      {/* Family members: personal areas are rows in the access list above. Parents have no access list. */}
      {member.role === "parent" && (
        <Card>
          <CardHeader title="Personal areas on this profile" />
          <HiddenAreasForm memberId={member.id} name={member.displayName} hidden={member.hiddenAreas} areas={HIDEABLE_AREAS.map((a) => ({ key: a.key, label: a.label }))} />
        </Card>
      )}

      {member.role !== "parent" && isMinor(member, todayIn(viewer.family.timezone)) && (
        <Card>
          <CardHeader title="Personal areas: parent oversight" />
          <ParentAccessForm
            memberId={member.id}
            name={member.displayName}
            hasLogin={!!member.userId}
            selected={member.parentAccess}
            areas={PRIVACY_CATEGORIES.filter((c) => !PRIVACY_META[c].perEntry && !member.hiddenAreas.includes(c)).map((c) => ({ key: c, label: PRIVACY_META[c].label }))}
          />
        </Card>
      )}

      <Card>
        <CardHeader title="Family Pantry: private food space" />
        <PrivateFoodForm memberId={member.id} name={member.displayName} enabled={member.privateFood} parentsCanSee={member.shareFoodWithParents} />
      </Card>

      <Card>
        <CardHeader title="Login" />
        {member.userId ? (
          member.id === viewer.member.id ? (
            <p className="text-[15px] text-muted">
              Change your own password on your{" "}
              <a href="/account" className="font-medium text-primary-700 underline">
                Account page
              </a>
              .
            </p>
          ) : member.role !== "parent" || viewer.family.ownerMemberId === viewer.member.id ? (
            <div className="flex flex-col gap-6">
              <MemberEmailForm memberId={member.id} name={member.displayName} email={loginEmail ?? ""} />
              <div className="border-t border-line pt-5">
                <ResetPasswordForm memberId={member.id} name={member.displayName} />
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-muted">{member.displayName} signs in with their own account. Only the family&apos;s owner can reset another parent&apos;s password.</p>
          )
        ) : (
          <LoginForm memberId={member.id} name={member.displayName} />
        )}
      </Card>

      {!isOwner && member.id !== viewer.member.id && (
        <Card className="border-wine-100">
          <CardHeader title="Remove from family" />
          <p className="mb-4 text-[15px] text-muted">
            {member.displayName} will no longer appear in the family or be able to sign in. Their history (completed chores, journal entries) is kept.
          </p>
          <form action={removeMember}>
            <input type="hidden" name="memberId" value={member.id} />
            <Button type="submit" variant="danger" icon={<UserMinus className="size-4" />}>
              Remove {member.displayName}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
