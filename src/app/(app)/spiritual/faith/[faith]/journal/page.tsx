import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { NotebookPen, Pencil, Plus } from "lucide-react";
import { db } from "@/db";
import { faithEntries, familyMembers } from "@/db/schema";
import { deleteFaithEntry, saveFaithEntry } from "@/app/actions/faith";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, TextAreaField, TextField } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { FaithSubTabs } from "@/components/faith/tabs";
import { fmtDate } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { FAITH_META, isFaith, type Faith } from "@/lib/faith-config";
import { nameFor } from "@/lib/names";

export const metadata: Metadata = { title: "Journal" };

export default async function FaithJournal({ params }: PageProps<"/spiritual/faith/[faith]/journal">) {
  const { faith: raw } = await params;
  if (!isFaith(raw)) redirect("/spiritual");
  if (raw === "spiritual") redirect("/spiritual/grimoire");
  const faith: Faith = raw;
  const viewer = await getViewer();
  const meta = FAITH_META[faith];
  const today = todayIn(viewer.family.timezone);
  const me = viewer.member.id;
  const rows = await db
    .select({ e: faithEntries, m: familyMembers })
    .from(faithEntries)
    .innerJoin(familyMembers, eq(familyMembers.id, faithEntries.memberId))
    .where(and(eq(faithEntries.familyId, viewer.family.id), eq(faithEntries.faith, faith), or(eq(faithEntries.memberId, me), and(eq(faithEntries.shared, true), ne(faithEntries.memberId, me)))))
    .orderBy(desc(faithEntries.date), desc(faithEntries.createdAt))
    .limit(200);
  const form = (e?: (typeof rows)[number]["e"]) => (
    <>
      {e ? <input type="hidden" name="id" value={e.id} /> : <input type="hidden" name="faith" value={faith} />}
      <FormRow>
        <DateField name="date" label="Date" required defaultValue={e?.date ?? today} />
        <TextField name="reference" label={meta.referenceLabel} maxLength={160} defaultValue={e?.reference ?? ""} />
      </FormRow>
      <TextField name="title" label="Title (optional)" maxLength={160} defaultValue={e?.title ?? ""} />
      <TextAreaField name="body" label="Entry" rows={8} required defaultValue={e?.body ?? ""} placeholder={meta.journalPrompt} />
      <CheckboxField name="shared" label="Share with my family" description="Otherwise only you can read it." defaultChecked={e?.shared} />
    </>
  );

  return (
    <>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600">
            {meta.emoji} {meta.label}
          </p>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">{meta.journalTitle}</h1>
          <p className="mt-1 text-[15px] text-muted">Private to you unless you share an entry.</p>
        </div>
        <FormModal title="New entry" triggerLabel="New entry" triggerIcon={<Plus className="size-4" />} action={saveFaithEntry}>
          {form()}
        </FormModal>
      </header>
      <FaithSubTabs faith={faith} active="journal" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<NotebookPen />} title="Your journal is empty" description={meta.journalPrompt} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map(({ e, m }) => {
            const mine = e.memberId === me;
            return (
              <li key={e.id}>
                <Card>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted">
                        {fmtDate(e.date)}
                        {!mine && ` · ${nameFor(viewer, m).split(" ")[0]}`}
                        {mine && e.shared && (
                          <>
                            {" "}
                            <Badge tone="primary">Shared</Badge>
                          </>
                        )}
                      </p>
                      {(e.title || e.reference) && (
                        <h2 className="mt-0.5 font-semibold">
                          {e.title}
                          {e.title && e.reference && " · "}
                          {e.reference && <span className="text-primary-700">{e.reference}</span>}
                        </h2>
                      )}
                    </div>
                    {mine && (
                      <span className="flex shrink-0">
                        <FormModal title="Edit entry" triggerContent={<Pencil className="mx-auto size-4" />} triggerAriaLabel="Edit entry" triggerClassName="size-9 rounded-full text-muted hover:bg-sunken" action={saveFaithEntry}>
                          {form(e)}
                        </FormModal>
                        <DeleteButton action={deleteFaithEntry} fields={{ id: e.id }} what="this entry" />
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{e.body}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
