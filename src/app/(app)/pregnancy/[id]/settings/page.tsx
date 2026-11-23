import type { Metadata } from "next";
import { deletePregnancy, setPregnancyStatus } from "@/app/actions/pregnancy";
import { ActionButton } from "@/components/forms/inline";
import { BirthModal, PregnancyForm, RemindersForm } from "@/components/pregnancy/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { pregnancyAccess } from "@/lib/pregnancy/data";
import { memberOptions } from "@/lib/queries";
import { PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Pregnancy settings" };
const btn = "h-10 rounded-xl px-3 text-sm font-medium ring-1 ring-line bg-surface hover:bg-sunken";

export default async function PregnancySettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pregnancyContext(id);
  const { viewer, p, now, canEdit } = ctx;
  const [members, access] = await Promise.all([memberOptions(viewer), pregnancyAccess(p.id)]);
  const canDelete = p.memberId === viewer.member.id || p.createdByMemberId === viewer.member.id;
  if (!canEdit) {
    return (
      <>
        <PregnancyHeader ctx={ctx} active="settings" />
        <Card>
          <p className="text-sm text-muted">Only the person who&apos;s pregnant (or someone they let edit) can change these settings.</p>
        </Card>
      </>
    );
  }
  return (
    <>
      <PregnancyHeader ctx={ctx} active="settings" />
      <div className="flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader title="Details & sharing" />
          <PregnancyForm
            members={members}
            me={viewer.member.id}
            isParent={viewer.isParent}
            item={{
              id: p.id,
              memberId: p.memberId,
              nickname: p.nickname,
              babyNickname: p.babyNickname,
              babySex: p.babySex,
              dueDate: p.dueDate,
              lmpDate: p.lmpDate,
              conceptionDate: p.conceptionDate,
              dueSource: p.dueSource,
              ivf: p.ivf ? { transferDate: p.ivf.transferDate ?? null, embryoDays: p.ivf.embryoDays ?? null, notes: p.ivf.notes ?? null } : null,
              pregnancyNumber: p.pregnancyNumber,
              previousPregnancies: p.previousPregnancies,
              babyCount: p.babyCount,
              provider: p.provider,
              providerPhone: p.providerPhone,
              providerEmail: p.providerEmail,
              providerAddress: p.providerAddress,
              hospital: p.hospital,
              birthLocation: p.birthLocation,
              notes: p.notes,
              visibility: p.visibility,
              shared: access.shared,
              letEdit: access.shared.length ? access.editors.length > 0 : true,
            }}
          />
        </Card>
        <Card>
          <CardHeader title="Reminders" />
          <RemindersForm pregnancyId={p.id} r={p.reminders} />
        </Card>
        <Card>
          <CardHeader title="Status" />
          <p className="mb-3 text-sm text-muted">Pause or archive to hide it from your dashboard. Nothing is deleted, and you can come back any time.</p>
          <div className="flex flex-wrap gap-2">
            {p.status !== "active" && (
              <ActionButton action={setPregnancyStatus} fields={{ id: p.id, status: "active" }} className={btn}>
                ▶ Continue tracking
              </ActionButton>
            )}
            {p.status === "active" && (
              <ActionButton action={setPregnancyStatus} fields={{ id: p.id, status: "paused" }} className={btn}>
                ⏸ Pause
              </ActionButton>
            )}
            {p.status !== "archived" && (
              <ActionButton action={setPregnancyStatus} fields={{ id: p.id, status: "archived" }} className={btn}>
                🗄 Archive
              </ActionButton>
            )}
            {p.status !== "completed" && p.status !== "born" && (
              <ActionButton action={setPregnancyStatus} fields={{ id: p.id, status: "completed" }} confirm="Mark this pregnancy as ended? You can continue tracking later if needed." className={btn}>
                Mark as ended
              </ActionButton>
            )}
            {p.status !== "born" && <BirthModal pregnancyId={p.id} now={now} babyCount={p.babyCount} babyName={p.babyNickname} isParent={viewer.isParent} canBaby={viewer.can("baby", "use")} location={p.hospital ?? p.birthLocation} />}
          </div>
          <p className="mt-3 text-xs text-muted">If this pregnancy ended in a loss, we&apos;re so sorry. You can mark it as ended or archive it, and keep or delete what&apos;s here whenever you&apos;re ready.</p>
        </Card>
        {canDelete && (
          <Card className="border-wine-100">
            <CardHeader title="Delete" />
            <p className="mb-3 text-sm text-muted">Permanently deletes this pregnancy with its logs, journal, photos, documents and its appointments on the calendar.</p>
            <ActionButton action={deletePregnancy} fields={{ id: p.id }} confirm="Delete this pregnancy and everything in it, including photos and calendar appointments? This can't be undone." className="h-10 rounded-xl bg-wine-50 px-3 text-sm font-medium text-wine-600 ring-1 ring-wine-100 hover:bg-wine-100">
              Delete pregnancy
            </ActionButton>
          </Card>
        )}
      </div>
    </>
  );
}
