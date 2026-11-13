import type { Metadata } from "next";
import { KeyRound, Mail } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { ChangeEmailForm, ChangePasswordForm } from "./forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await getViewer();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow="Account" title="Sign-in & security" description={`Signed in as ${viewer.user.email}.`} />
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
