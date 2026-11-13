import type { Metadata } from "next";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Globe, Heart, Mail, Phone, Wrench } from "lucide-react";
import { deleteVendor, saveVendor, toggleVendorFavorite } from "@/app/actions/maintenance";
import { RecordModal } from "@/components/forms/config-form";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { VENDOR_FIELDS, VENDOR_TRADES } from "@/lib/maintenance-config";
import { cn } from "@/lib/utils";
import { maintViewer } from "../shared";

export const metadata: Metadata = { title: "Service providers" };

export default async function VendorsPage() {
  const viewer = await maintViewer();
  const rows = await db
    .select({
      v: vendors,
      jobs: sql<number>`(select count(*)::int from home_repairs r where r.vendor_id = ${vendors.id})`,
      last: sql<string | null>`(select max(coalesce(r.completed_on, r.reported_on))::text from home_repairs r where r.vendor_id = ${vendors.id})`,
    })
    .from(vendors)
    .where(eq(vendors.familyId, viewer.family.id))
    .orderBy(desc(vendors.isFavorite), asc(vendors.name));
  const canEdit = viewer.can("maintenance", "edit");
  const add = canEdit ? <RecordModal title="Add a service provider" triggerLabel="Add provider" action={saveVendor} fields={VENDOR_FIELDS} size="md" /> : undefined;
  return (
    <>
      <PageHeader eyebrow="Home Maintenance" title="Service providers" description="Plumbers, electricians, cleaners and everyone else you call, with how they did. Link them to repairs." actions={add} />
      <MaintenanceTabs active="vendors" />
      {rows.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ v, jobs, last }) => (
            <article key={v.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
              <header className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{v.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {v.trade && <Badge tone="primary">{VENDOR_TRADES.find((t) => t.value === v.trade)?.label ?? v.trade}</Badge>}
                    {v.rating && <Badge tone="olive">{"★".repeat(v.rating)}</Badge>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0">
                    <ActionButton action={toggleVendorFavorite} fields={{ id: v.id }} label={v.isFavorite ? "Unfavorite" : "Favorite"} className="size-9 rounded-full hover:bg-sunken">
                      <Heart className={cn("size-4", v.isFavorite ? "fill-wine-500 text-wine-500" : "text-muted")} />
                    </ActionButton>
                    <RecordModal edit title={`Edit ${v.name}`} action={saveVendor} fields={VENDOR_FIELDS} size="md" hidden={{ id: v.id }} defaults={{ name: v.name, trade: v.trade, contactName: v.contactName, phone: v.phone, email: v.email, website: v.website, address: v.address, notes: v.notes, rating: v.rating ? String(v.rating) : null }} />
                    <DeleteButton action={deleteVendor} fields={{ id: v.id }} what={v.name} />
                  </div>
                )}
              </header>
              {v.contactName && <p className="text-sm">{v.contactName}</p>}
              <div className="flex flex-col gap-1 text-sm">
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="inline-flex items-center gap-2 text-primary-700 hover:underline">
                    <Phone className="size-4" aria-hidden /> {v.phone}
                  </a>
                )}
                {v.email && (
                  <a href={`mailto:${v.email}`} className="inline-flex items-center gap-2 text-primary-700 hover:underline">
                    <Mail className="size-4" aria-hidden /> {v.email}
                  </a>
                )}
                {v.website && (
                  <a href={v.website} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 text-primary-700 hover:underline">
                    <Globe className="size-4" aria-hidden /> Website
                  </a>
                )}
              </div>
              {v.notes && <p className="text-sm text-ink-soft">{v.notes}</p>}
              <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted">
                <Wrench className="size-3.5" aria-hidden /> {jobs} repair{jobs === 1 ? "" : "s"}
                {last && ` · last ${fmtDate(last)}`}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Phone />} title="No service providers yet" description="Save the people you trust so anyone in the family can call them." action={add} />
        </Card>
      )}
    </>
  );
}
