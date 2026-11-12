import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { KeyRound, Lock, Pencil } from "lucide-react";
import { db } from "@/db";
import { householdInfo } from "@/db/schema";
import { deleteInfo, saveInfo } from "@/app/actions/house";
import { FormModal } from "@/components/forms/action-form";
import { TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer, visibleTo } from "@/lib/dal";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Important info" };

type I = typeof householdInfo.$inferSelect;
function InfoFields({ i, members, shared }: { i?: I; members: MemberOption[]; shared?: string[] }) {
  return (
    <>
      {i && <input type="hidden" name="id" value={i.id} />}
      <TextField name="title" label="Title" required defaultValue={i?.title} placeholder="Wi-Fi password" />
      <TextAreaField name="body" label="Details" rows={4} required defaultValue={i?.body} placeholder="Network: Vanderbilt-Home · Password: …" />
      <VisibilityField members={members} defaultValue={i?.visibility} defaultSelected={shared} />
    </>
  );
}

export default async function InfoPage() {
  const viewer = await getViewer();
  if (!viewer.can("house")) notFound();
  const canManage = viewer.can("house", "edit");
  const [members, rows] = await Promise.all([
    memberOptions(viewer),
    db
      .select()
      .from(householdInfo)
      .where(and(eq(householdInfo.familyId, viewer.family.id), visibleTo(viewer, { id: householdInfo.id, visibility: householdInfo.visibility, author: householdInfo.createdByMemberId }, "household_info")))
      .orderBy(asc(householdInfo.title)),
  ]);
  const access = await getRecordAccess("household_info", rows.map((r) => r.id));
  const add = (
    <FormModal title="Add important info" triggerLabel="Add info" action={saveInfo}>
      <InfoFields members={members} />
    </FormModal>
  );
  return (
    <>
      <PageHeader eyebrow="House" title="Important info" description="Wi-Fi, alarm codes, utility accounts, emergency contacts: the things everyone asks about." actions={canManage ? add : undefined} />
      <HouseTabs active="info" viewer={viewer} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<KeyRound />} title="Nothing saved yet" description="Keep key household details in one place, private or shared." example="Wi-Fi password · Plumber: 555-0134 · Water shut-off: basement, left of furnace" action={canManage ? add : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((i) => (
            <li key={i.id}>
              <Card className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-sans text-[15px] font-semibold">{i.title}</h2>
                  <div className="-mt-2 -mr-2 flex items-center">
                    {i.visibility !== "family" && (
                      <Badge tone="mist">
                        <Lock className="size-3" /> {i.visibility === "private" ? "Private" : "Shared"}
                      </Badge>
                    )}
                    {canManage && (
                      <>
                        <FormModal
                          title="Edit info"
                          action={saveInfo}
                          triggerAriaLabel="Edit"
                            triggerClassName="size-9 rounded-full text-muted hover:bg-sunken"
                            triggerContent={<Pencil className="mx-auto size-4" />}
                        >
                          <InfoFields i={i} members={members} shared={access.get(i.id)} />
                        </FormModal>
                        <DeleteButton action={deleteInfo} fields={{ id: i.id }} what={`"${i.title}"`} />
                      </>
                    )}
                  </div>
                </div>
                <p className="text-[15px] whitespace-pre-line text-ink-soft">{i.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
