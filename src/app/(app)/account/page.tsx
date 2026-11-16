import type { Metadata } from "next";
import { KeyRound, Mail, Palette } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/display";
import { ProfilePhotoButton } from "@/components/photos/profile-photo";
import { fileUrl } from "@/lib/files";
import { getViewer } from "@/lib/dal";
import { AppThemeForm, ChangeEmailForm, ChangePasswordForm } from "./forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await getViewer();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow="Account" title="My settings" description={`Signed in as ${viewer.user.email}.`} />
      <Card className="flex flex-wrap items-center gap-4">
        <Avatar name={viewer.member.displayName} color={viewer.member.color} size="xl" photoUrl={fileUrl(viewer.member.avatarFileId, true)} />
        <div className="flex-1">
          <p className="font-semibold">Profile photo</p>
          <p className="text-sm text-muted">Shown on your avatar around the app.</p>
        </div>
        <ProfilePhotoButton memberId={viewer.member.id} currentUrl={fileUrl(viewer.member.avatarFileId)} label={viewer.member.avatarFileId ? "Change photo" : "Add photo"} />
      </Card>
      <Card>
        <CardHeader title="My app colors" icon={<Palette className="size-4" />} />
        <AppThemeForm current={viewer.member.appTheme} />
      </Card>
      <Card>
        <CardHeader title="Change password" icon={<KeyRound className="size-4" />} />
        <ChangePasswordForm />
      </Card>
      <Card>
        <CardHeader title="Change email" icon={<Mail className="size-4" />} />
        <ChangeEmailForm email={viewer.user.email} />
      </Card>
      <p className="text-sm text-muted">Forgot a password? A parent can set a new one from Family → the person → Manage.</p>
    </div>
  );
}
