import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Camera, CalendarClock, FileText, Pill, Salad, Stethoscope, TriangleAlert, UserRound } from "lucide-react";
import { saveMedicalRecord, saveMemberPhoto } from "@/app/actions/medical";
import { FormModal } from "@/components/forms/action-form";
import { RecordModal } from "@/components/forms/config-form";
import { ImageField } from "@/components/forms/fields";
import { MedicalRecordCard, VisibilityBadge, medicalDefaults } from "@/components/medical/record-card";
import { DetailList } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/display";
import { getFamilyMember } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { listMedical, medicalAppointments } from "@/lib/medical";
import { KIND_LABEL, MEDICAL_FIELDS, type MedicalKind } from "@/lib/medical-config";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { AppointmentList } from "../../appointment-list";
import { AppointmentModal } from "../../appointment-modal";
import { medicalViewer } from "../../kind-page";
import { MedicalDisclaimer, MedicalTabs } from "../../medical-tabs";

export const metadata: Metadata = { title: "Medical profile" };

const SECTIONS: { kind: Exclude<MedicalKind, "profile">; title: string; icon: React.ReactNode }[] = [
  { kind: "allergy", title: "Allergies", icon: <TriangleAlert className="size-4" /> },
  { kind: "restriction", title: "Food restrictions", icon: <Salad className="size-4" /> },
  { kind: "condition", title: "Conditions", icon: <Stethoscope className="size-4" /> },
  { kind: "medication", title: "Medications", icon: <Pill className="size-4" /> },
  { kind: "document", title: "Documents", icon: <FileText className="size-4" /> },
];

export default async function MemberMedicalPage({ params }: PageProps<"/medical/members/[memberId]">) {
  const { memberId } = await params;
  const viewer = await medicalViewer();
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) notFound();
  const member = await getFamilyMember(viewer, memberId);
  if (!member) notFound();
  const canEdit = viewer.can("medical", "edit");
  const [members, profileRows, appts, ...lists] = await Promise.all([
    memberOptions(viewer),
    listMedical(viewer, "profile", memberId),
    medicalAppointments(viewer, { memberId }),
    ...SECTIONS.map((s) => listMedical(viewer, s.kind, memberId)),
  ]);
  const profile = profileRows[0]?.r;
  const ids = [...(profile ? [profile.id] : []), ...lists.flatMap((l) => l.map(({ r }) => r.id))];
  const access = await getRecordAccess("medical", ids);
  const vis = { privateLabel: "Private (patient & parents)" };
  const canPhoto = viewer.isParent || viewer.member.id === memberId;
  const now = new Date();
  return (
    <>
      <PageHeader
        eyebrow="Medical"
        title={
          <span className="flex items-center gap-4">
            <Avatar name={member.displayName} color={member.color} photoUrl={fileUrl(member.avatarFileId, true)} size="xl" />
            {member.displayName}
          </span>
        }
        actions={
          <>
            {canPhoto && (
              <FormModal title="Profile photo" action={saveMemberPhoto} triggerVariant="secondary" triggerIcon={<Camera className="size-4" />} triggerLabel="Photo" size="sm">
                <input type="hidden" name="memberId" value={member.id} />
                <ImageField name="image" label="Photo" currentUrl={fileUrl(member.avatarFileId)} />
              </FormModal>
            )}
            {canEdit && <AppointmentModal members={members} d={{ memberId: member.id }} />}
          </>
        }
      />
      <MedicalTabs active="members" />

      <Card className="mb-6">
        <CardHeader
          title="Medical profile"
          icon={<UserRound className="size-4" />}
          action={
            canEdit && (
              <span className="flex items-center gap-2">
                {profile && <VisibilityBadge v={profile.visibility} shared={access.get(profile.id)?.length} />}
                <RecordModal
                  edit={!!profile}
                  title={profile ? "Edit medical profile" : "Create profile"}
                  triggerVariant="soft"
                  action={saveMedicalRecord}
                  fields={MEDICAL_FIELDS.profile}
                  defaults={profile ? medicalDefaults("profile", profile as never) : { fullName: member.displayName }}
                  hidden={{ kind: "profile", memberId: member.id, ...(profile ? { id: profile.id } : {}) }}
                  members={members}
                  visibility={{ ...vis, defaultValue: profile?.visibility ?? "private", selected: profile ? access.get(profile.id) : [] }}
                />
              </span>
            )
          }
        />
        {profile ? (
          <DetailList fields={MEDICAL_FIELDS.profile} values={profile as never} />
        ) : (
          <p className="text-sm text-muted">No profile yet. Add physicians, emergency contacts and insurance details.</p>
        )}
      </Card>

      <Card className="mb-6">
        <CardHeader title="Appointments" icon={<CalendarClock className="size-4" />} />
        <AppointmentList viewer={viewer} rows={appts.filter((a) => a.startsAt >= now)} members={members} empty="No upcoming appointments." />
      </Card>

      {SECTIONS.map((s, i) => (
        <section key={s.kind} className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">{s.icon}</span>
              {s.title}
            </h2>
            {canEdit && (
              <RecordModal
                title={`Add ${KIND_LABEL[s.kind].toLowerCase()}`}
                triggerLabel="Add"
                triggerVariant="soft"
                action={saveMedicalRecord}
                fields={MEDICAL_FIELDS[s.kind]}
                defaults={{ active: true }}
                hidden={{ kind: s.kind, memberId: member.id }}
                members={members}
                visibility={{ ...vis, defaultValue: "private" }}
              />
            )}
          </div>
          {lists[i]!.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {lists[i]!.map(({ r }) => (
                <MedicalRecordCard key={r.id} kind={s.kind} r={r as never} member={member} members={members} canEdit={canEdit} sharedWith={access.get(r.id) ?? []} showMember={false} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">None recorded.</p>
          )}
        </section>
      ))}
      <MedicalDisclaimer />
    </>
  );
}
