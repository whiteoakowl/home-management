import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, or } from "drizzle-orm";
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
import { LinkTabs } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Important Info" };

type I = typeof householdInfo.$inferSelect;
const kindOf = (i: I): BinderKind => (isBinderKind(i.kind) ? i.kind : "note");
const defaultsOf = (i: I): Record<string, string> => (kindOf(i) === "note" && !Object.keys(i.fields).length ? { title: i.title, body: i.body } : i.fields);

export default async function InfoPage({ searchParams }: PageProps<"/house/info">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  // Tabs: All, or one category of the binder.
  const tab: BinderKind | "all" = typeof sp.tab === "string" && isBinderKind(sp.tab) ? sp.tab : "all";
  // Everyone in the family can open Important Info; each entry decides who sees it.
  if (!viewer.family.enabledModules.includes("info")) notFound();
  const canManage = true;
  const [members, rows] = await Promise.all([
    memberOptions(viewer),
    db
      .select()
      .from(householdInfo)
      .where(
        and(
          eq(householdInfo.familyId, viewer.family.id),
          or(
            and(isNull(householdInfo.privateOwnerId), visibleTo(viewer, { id: householdInfo.id, visibility: householdInfo.visibility, author: householdInfo.createdByMemberId }, "household_info")),
            // Older "My info" entries: still only their owner's.
            eq(householdInfo.privateOwnerId, viewer.member.id),
          ),
        ),
      )
      .orderBy(asc(householdInfo.title)),
  ]);
  const access = await getRecordAccess("household_info", rows.map((r) => r.id));
  const own = (i?: I) => !!i?.privateOwnerId;
  const hidden = (k: BinderKind, i?: I): Record<string, string> => ({ kind: k, ...(i ? { id: i.id } : {}), ...(own(i) ? { space: "mine" } : {}) });
  const vis = (i?: I) => (own(i) ? undefined : { defaultValue: i?.visibility ?? (i && kindOf(i) === "insurance" ? "parents" : "family"), selected: i ? access.get(i.id) : undefined, privateLabel: "Only me" });
  const addFor = (k: BinderKind, variant: "primary" | "secondary" | "soft" | "ghost" = "soft", label?: string) => (
    <RecordModal title={`Add ${BINDER[k].one}`} triggerLabel={label ?? "Add"} triggerVariant={variant} action={saveInfo} fields={BINDER[k].fields} hidden={hidden(k)} members={members} visibility={{ defaultValue: k === "insurance" ? "parents" : "family", privateLabel: "Only me" }} size="md" />
  );
  const byKind = new Map<BinderKind, I[]>();
  for (const r of rows) byKind.set(kindOf(r), [...(byKind.get(kindOf(r)) ?? []), r]);
  // On a category tab, that category shows even when it's empty (with its Add button).
  const used = tab === "all" ? BINDER_KINDS.filter((k) => byKind.has(k)) : [tab];
  const empty = tab === "all" ? BINDER_KINDS.filter((k) => !byKind.has(k)) : [];

  return (
    <>
      <PageHeader help="important-info"
        eyebrow="House"
        title="Important Info"
        description="Your family binder: emergency contacts, doctors, school, insurance, Wi-Fi and everything a sitter needs. Each entry is shared only with the people you choose."
        actions={
          rows.some((r) => BINDER[kindOf(r)].sitter) ? (
            <ButtonLink href="/house/info/sitter" variant="secondary" icon={<Printer className="size-4" />}>
              Babysitter sheet
            </ButtonLink>
          ) : undefined
        }
      />
      <LinkTabs
        active={tab}
        className="mb-6"
        tabs={[
          { key: "all", href: "/house/info", label: "All", count: rows.length },
          ...BINDER_KINDS.map((k) => ({ key: k, href: `/house/info?tab=${k}`, label: `${BINDER[k].emoji} ${BINDER[k].label}`, count: byKind.get(k)?.length ?? 0 })),
        ]}
      />
      <div className="flex flex-col gap-8">
        {used.map((k) => (
          <section key={k} id={k} className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden>{BINDER[k].emoji}</span> {BINDER[k].label}
              </h2>
              {canManage && byKind.has(k) && addFor(k)}
            </div>
            {!byKind.has(k) && (
              <Card>
                <p className="text-sm text-muted">{BINDER[k].blurb}</p>
                {canManage && <div className="mt-3">{addFor(k, "primary", `Add ${BINDER[k].one}`)}</div>}
              </Card>
            )}
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(byKind.get(k) ?? []).map((i) => (
                <li key={i.id}>
                  <Card className="flex h-full flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-sans text-[15px] font-semibold">{i.title}</h3>
                      <div className="-mt-2 -mr-2 flex items-center">
                        {(own(i) || i.visibility !== "family") && (
                          <Badge tone="mist">
                            <Lock className="size-3" /> {own(i) || i.visibility === "private" ? "Only me" : i.visibility === "parents" ? "Parents" : `${(access.get(i.id) ?? []).length + 1} people`}
                          </Badge>
                        )}
                        {canManage && (own(i) || canChangeItem(viewer, i.createdByMemberId)) && (
                          <>
                            <RecordModal title={`Edit ${BINDER[k].one}`} edit action={saveInfo} fields={BINDER[k].fields} defaults={defaultsOf(i)} hidden={hidden(k, i)} members={members} visibility={vis(i)} size="md" />
                            <DeleteButton action={deleteInfo} fields={{ id: i.id, ...(own(i) ? { space: "mine" } : {}) }} what={`"${i.title}"`} />
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
          <h2 className="mb-1 text-lg font-semibold">{used.length ? "Add more to Important Info" : "Start your family binder"}</h2>
          <p className="mb-4 text-sm text-muted">Everything a grandparent, babysitter or the family needs, in one place. You choose who can see each entry.</p>
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
