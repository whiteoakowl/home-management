import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { FileText, Upload } from "lucide-react";
import { db } from "@/db";
import { categories, homeDocuments } from "@/db/schema";
import { deleteDocument, saveDocument } from "@/app/actions/house";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, SelectField, TextAreaField, TextField, VisibilityField } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/form";
import { getViewer, visibleTo } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { categoryOptions, memberOptions } from "@/lib/queries";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Home documents" };

export default async function DocumentsPage() {
  const viewer = await getViewer();
  if (!viewer.can("house")) notFound();
  const canManage = viewer.can("house", "edit");
  const today = todayIn(viewer.family.timezone);
  const [members, cats, docs] = await Promise.all([
    memberOptions(viewer),
    categoryOptions(viewer, "household"),
    db
      .select({ d: homeDocuments, category: categories.name })
      .from(homeDocuments)
      .leftJoin(categories, eq(categories.id, homeDocuments.categoryId))
      .where(and(eq(homeDocuments.familyId, viewer.family.id), visibleTo(viewer, { id: homeDocuments.id, visibility: homeDocuments.visibility, author: homeDocuments.createdByMemberId }, "document")))
      .orderBy(asc(homeDocuments.title)),
  ]);
  const add = (
    <FormModal title="Upload a document" triggerLabel="Upload" triggerIcon={<Upload className="size-4" />} action={saveDocument} submitLabel="Upload">
      <TextField name="title" label="Title" required placeholder="Furnace warranty" />
      <Field label="File (PDF or image, up to 10 MB)" htmlFor="f-file">
        <input id="f-file" name="file" type="file" accept="application/pdf,image/*" className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
      </Field>
      <FormRow>
        <SelectField name="categoryId" label="Category" placeholder="None" options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        <DateField name="expiresOn" label="Expires / renews" />
      </FormRow>
      <TextAreaField name="notes" label="Notes" rows={2} />
      <VisibilityField members={members} />
    </FormModal>
  );
  return (
    <>
      <PageHeader eyebrow="House" title="Documents" description="Warranties, manuals, insurance policies and anything you'll need to find later." actions={canManage ? add : undefined} />
      <HouseTabs active="documents" viewer={viewer} />
      {docs.length === 0 ? (
        <Card>
          <EmptyState icon={<FileText />} title="No documents yet" description="Upload PDFs or photos and find them in seconds." example="Home insurance, appliance manuals, HOA rules" action={canManage ? add : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map(({ d, category }) => (
            <li key={d.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <FileText className="size-5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <a href={fileUrl(d.fileId) ?? "#"} target="_blank" rel="noreferrer" className="truncate font-semibold hover:underline">
                  {d.title}
                </a>
                {d.notes && <p className="line-clamp-2 text-sm text-muted">{d.notes}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {category && <Badge>{category}</Badge>}
                  {d.expiresOn && <Badge tone={d.expiresOn < today ? "wine" : "olive"}>{d.expiresOn < today ? "Expired" : "Expires"} {formatShortDate(d.expiresOn)}</Badge>}
                  {d.visibility !== "family" && <Badge tone="mist">{d.visibility === "private" ? "Private" : "Shared"}</Badge>}
                </div>
              </div>
              {canManage && <DeleteButton action={deleteDocument} fields={{ id: d.id }} what={`"${d.title}"`} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
