import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { KeyRound, Lock, Printer } from "lucide-react";
import { db } from "@/db";
import { householdInfo } from "@/db/schema";
import { deleteInfo, saveInfo } from "@/app/actions/house";
import { RecordModal } from "@/components/forms/config-form";
import { BinderFields } from "@/components/binder/binder-item";
import { ButtonLink } from "@/components/ui/button";
import { BINDER, BINDER_KINDS, isBinderKind, type BinderKind } from "@/lib/binder";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { canChangeItem, getViewer, visibleTo } from "@/lib/dal";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { HouseTabs } from "../house-tabs";
import { SegmentLinks } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Important info" };

type I = typeof householdInfo.$inferSelect;
const kindOf = (i: I): BinderKind => (isBinderKind(i.kind) ? i.kind : "note");
const defaultsOf = (i: I): Record<string, string> => (kindOf(i) === "note" && !Object.keys(i.fields).length ? { title: i.title, body: i.body } : i.fields);

export default async function InfoPage({ searchParams }: PageProps<"/house/info">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  // Family members have their own private Important Info ("My info"), which parents never see.
  const hasMine = !viewer.isParent && viewer.member.privateInfo;
  const mine = hasMine && (sp.space === "mine" || !viewer.can("info"));
  if (!mine && !viewer.can("info")) notFound();
  const canManage = mine || viewer.can("info", "edit");
  const [members, rows] = await Promise.all([
    memberOptions(viewer),
    db
      .select()
      .from(householdInfo)
      .where(
        mine
          ? and(eq(householdInfo.familyId, viewer.family.id), eq(householdInfo.privateOwnerId, viewer.member.id))
          : and(eq(householdInfo.familyId, viewer.family.id), isNull(householdInfo.privateOwnerId), visibleTo(viewer, { id: householdInfo.id, visibility: householdInfo.visibility, author: householdInfo.createdByMemberId }, "household_info")),
      )
      .orderBy(asc(householdInfo.title)),
  ]);
  const access = await getRecordAccess("household_info", rows.map((r) => r.id));
  const hidden = (k: BinderKind, i?: I): Record<string, string> => ({ kind: k, ...(i ? { id: i.id } : {}), ...(mine ? { space: "mine" } : {}) });
  const vis = (i?: I) => (mine ? undefined : { defaultValue: i?.visibility ?? (k0(i) === "insurance" ? "parents" : "family"), selected: i ? access.get(i.id) : undefined, privateLabel: "Only me" });
  const k0 = (i?: I) => (i ? kindOf(i) : null);
  const addFor = (k: BinderKind, variant: "primary" | "secondary" | "soft" | "ghost" = "soft", label?: string) => (
    <RecordModal title={`Add ${BINDER[k].one}`} triggerLabel={label ?? "Add"} triggerVariant={variant} action={saveInfo} fields={BINDER[k].fields} hidden={hidden(k)} members={members} visibility={vis()} size="md" />
  );
  const byKind = new Map<BinderKind, I[]>();
  for (const r of rows) byKind.set(kindOf(r), [...(byKind.get(kindOf(r)) ?? []), r]);
  const used = BINDER_KINDS.filter((k) => byKind.has(k));
  const empty = BINDER_KINDS.filter((k) => !byKind.has(k));

  return (
    <>
      <PageHeader
        eyebrow={mine ? "My private" : "House"}
        title={mine ? "My important info" : "Family binder"}
        description={mine ? "Your own codes, accounts, contacts and notes. Only you can see these, not even parents." : "Your family binder: emergency contacts, doctors, school, insurance, Wi-Fi and everything a sitter needs."}
        actions={
          !mine && rows.some((r) => BINDER[kindOf(r)].sitter) ? (
            <ButtonLink href="/house/info/sitter" variant="secondary" icon={<Printer className="size-4" />}>
              Babysitter sheet
            </ButtonLink>
          ) : undefined
        }
      />
      {viewer.can("house") && <HouseTabs active="info" viewer={viewer} />}
      {hasMine && viewer.can("info") && (
        <div className="mb-5">
          <SegmentLinks fit active={mine ? "mine" : "family"} items={[{ key: "family", href: "/house/info", label: "Family info" }, { key: "mine", href: "/house/info?space=mine", label: "My info (private)" }]} />
        </div>
      )}
      {used.length > 1 && (
        <nav aria-label="Binder sections" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {used.map((k) => (
            <a key={k} href={`#${k}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium hover:border-primary-300">
              <span aria-hidden>{BINDER[k].emoji}</span> {BINDER[k].label} <span className="text-muted">{byKind.get(k)!.length}</span>
            </a>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-8">
        {used.map((k) => (
          <section key={k} id={k} className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden>{BINDER[k].emoji}</span> {BINDER[k].label}
              </h2>
              {canManage && addFor(k)}
            </div>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {byKind.get(k)!.map((i) => (
                <li key={i.id}>
                  <Card className="flex h-full flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-sans text-[15px] font-semibold">{i.title}</h3>
                      <div className="-mt-2 -mr-2 flex items-center">
                        {!mine && i.visibility !== "family" && (
                          <Badge tone="mist">
                            <Lock className="size-3" /> {i.visibility === "private" ? "Only me" : i.visibility === "parents" ? "Parents" : "Shared"}
                          </Badge>
                        )}
                        {canManage && (mine || canChangeItem(viewer, i.createdByMemberId)) && (
                          <>
                            <RecordModal title={`Edit ${BINDER[k].one}`} edit action={saveInfo} fields={BINDER[k].fields} defaults={defaultsOf(i)} hidden={hidden(k, i)} members={members} visibility={vis(i)} size="md" />
                            <DeleteButton action={deleteInfo} fields={{ id: i.id, ...(mine ? { space: "mine" } : {}) }} what={`"${i.title}"`} />
                          </>
                        )}
                      </div>
                    </div>
                    <BinderFields kind={k} fields={i.fields} title={i.title} body={i.body} />
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {canManage && empty.length > 0 && (
        <section className={used.length ? "mt-10" : ""}>
          <h2 className="mb-1 text-lg font-semibold">{used.length ? "Add more to your binder" : "Start your family binder"}</h2>
          <p className="mb-4 text-sm text-muted">Everything a grandparent, babysitter or the family needs, in one place.</p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {empty.map((k) => (
              <li key={k} className="flex items-start gap-3 rounded-2xl border border-dashed border-line-strong bg-surface/60 p-4">
                <span className="text-2xl" aria-hidden>
                  {BINDER[k].emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{BINDER[k].label}</p>
                  <p className="mb-2 text-sm text-muted">{BINDER[k].blurb}</p>
                  {addFor(k, "secondary", `Add ${BINDER[k].one}`)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!canManage && rows.length === 0 && (
        <Card>
          <EmptyState icon={<KeyRound />} title="Nothing saved yet" description="Parents can add emergency contacts, doctors, Wi-Fi and more here." />
        </Card>
      )}
    </>
  );
}
