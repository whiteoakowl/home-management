import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, PageHeader } from "@/components/ui/display";
import { listFamilyMembers } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { listMedical } from "@/lib/medical";
import { medicalViewer } from "../kind-page";
import { MedicalDisclaimer, MedicalTabs } from "../medical-tabs";

export const metadata: Metadata = { title: "Family members · Medical" };

export default async function MedicalMembersPage() {
  const viewer = await medicalViewer();
  const [fam, profiles, alls, conds, meds] = await Promise.all([
    listFamilyMembers(viewer.family.id),
    listMedical(viewer, "profile"),
    listMedical(viewer, "allergy"),
    listMedical(viewer, "condition"),
    listMedical(viewer, "medication"),
  ]);
  const n = (rows: { r: { memberId: string } }[], id: string) => rows.filter(({ r }) => r.memberId === id).length;
  return (
    <>
      <PageHeader eyebrow="Medical" title="Family members" description="Open a person to see their medical profile, insurance, allergies, conditions, medications and documents." />
      <MedicalTabs active="members" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fam.map((m) => {
          const p = profiles.find(({ r }) => r.memberId === m.id)?.r;
          return (
            <Link key={m.id} href={`/medical/members/${m.id}`} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-primary-300">
              <div className="flex items-center gap-4">
                <Avatar name={m.displayName} color={m.color} photoUrl={fileUrl(m.avatarFileId, true)} size="xl" />
                <div className="min-w-0">
                  <p className="font-display text-xl font-semibold">{m.displayName}</p>
                  <p className="truncate text-sm text-muted">{p?.primaryPhysician ? `Physician: ${p.primaryPhysician}` : p ? "Profile on file" : "No profile yet"}</p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Allergies", n(alls, m.id)],
                  ["Conditions", n(conds.filter(({ r }) => r.active), m.id)],
                  ["Medications", n(meds.filter(({ r }) => r.active), m.id)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-sunken py-2">
                    <dd className="font-display text-xl font-semibold">{v}</dd>
                    <dt className="text-xs text-muted">{l}</dt>
                  </div>
                ))}
              </dl>
            </Link>
          );
        })}
      </div>
      <MedicalDisclaimer />
    </>
  );
}
