import type { Metadata } from "next";
import { and, asc, eq, inArray } from "drizzle-orm";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { fmtDate } from "@/components/records/detail-list";
import { PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { homeDocuments, homeItems, householdInfo, petCareNotes, pets, rooms, vendors } from "@/db/schema";
import { listChoreTemplates } from "@/lib/chores";
import { visibleTo } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { VENDOR_TRADES } from "@/lib/maintenance-config";
import { describeRule } from "@/lib/recurrence";
import { maintViewer } from "../shared";

export const metadata: Metadata = { title: "Household manual" };

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 border-b border-line pb-1 font-display text-2xl font-semibold break-after-avoid">{children}</h2>;
}

/**
 * One printable guide to the house for a sitter, guest or new family member:
 * key info, systems, appliances, who to call, upkeep and pets.
 */
export default async function HouseholdManual() {
  const viewer = await maintViewer();
  const fid = viewer.family.id;
  const today = todayIn(viewer.family.timezone);
  const [info, spaces, appliances, docs, providers, upkeep, petRows] = await Promise.all([
    viewer.can("house")
      ? db.select().from(householdInfo).where(and(eq(householdInfo.familyId, fid), visibleTo(viewer, { id: householdInfo.id, visibility: householdInfo.visibility, author: householdInfo.createdByMemberId }, "household_info"))).orderBy(asc(householdInfo.title))
      : Promise.resolve([]),
    db.select().from(rooms).where(eq(rooms.familyId, fid)).orderBy(asc(rooms.kind), asc(rooms.sortOrder), asc(rooms.name)),
    db.select().from(homeItems).where(and(eq(homeItems.familyId, fid), eq(homeItems.category, "appliance"))).orderBy(asc(homeItems.name)),
    db.select().from(homeDocuments).where(and(eq(homeDocuments.familyId, fid), inArray(homeDocuments.docType, ["manual", "paint", "instructions"]), visibleTo(viewer, { id: homeDocuments.id, visibility: homeDocuments.visibility, author: homeDocuments.createdByMemberId }, "document"))).orderBy(asc(homeDocuments.title)),
    db.select().from(vendors).where(eq(vendors.familyId, fid)).orderBy(asc(vendors.trade), asc(vendors.name)),
    listChoreTemplates(viewer, ["maintenance"], today),
    viewer.can("pets") ? db.select({ name: pets.name, species: pets.species, vet: pets.veterinarian, vetPhone: pets.vetPhone, kind: petCareNotes.kind, body: petCareNotes.body }).from(pets).leftJoin(petCareNotes, eq(petCareNotes.petId, pets.id)).where(and(eq(pets.familyId, fid), eq(pets.status, "active"))) : Promise.resolve([]),
  ]);
  const systems = spaces.filter((s) => s.kind !== "room" || s.description || s.notes);
  const paint = docs.filter((d) => d.docType === "paint");
  const manuals = docs.filter((d) => d.docType !== "paint");
  const petGroups = Map.groupBy(petRows, (p) => p.name);
  return (
    <article>
      <div className="print:hidden">
        <PageHeader eyebrow="Home Maintenance" title="Household manual" description="Everything a sitter, guest or new family member needs to know about the house, in one printable guide. It updates itself from the rest of the app." actions={<PrintButton label="Print or save as PDF" />} />
        <MaintenanceTabs active="manual" />
      </div>
      <div className="mx-auto max-w-3xl rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-10 print:border-0 print:p-0">
        <header className="text-center">
          <p className="text-sm tracking-[0.3em] text-muted uppercase">Household manual</p>
          <h1 className="font-display text-4xl font-semibold">The {viewer.family.name} Home</h1>
          {viewer.family.locationName && <p className="text-muted">{viewer.family.locationName}</p>}
          <p className="text-xs text-muted">Updated {fmtDate(today)}</p>
        </header>

        {info.length > 0 && (
          <>
            <H>Key information</H>
            {info.map((i) => (
              <section key={i.id} className="mb-4 break-inside-avoid">
                <h3 className="font-semibold">{i.title}</h3>
                <p className="text-sm whitespace-pre-line">{i.body}</p>
              </section>
            ))}
          </>
        )}

        {providers.length > 0 && (
          <>
            <H>Who to call</H>
            <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {providers.map((v) => (
                <li key={v.id} className="break-inside-avoid">
                  <strong>{VENDOR_TRADES.find((t) => t.value === v.trade)?.label ?? "Service"}:</strong> {v.name}
                  {v.contactName && ` (${v.contactName})`}
                  {v.phone && <span className="block">{v.phone}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {systems.length > 0 && (
          <>
            <H>Home systems & spaces</H>
            {systems.map((s) => (
              <section key={s.id} className="mb-3 break-inside-avoid text-sm">
                <h3 className="text-base font-semibold">{s.name}</h3>
                {s.description && <p>{s.description}</p>}
                {s.notes && <p className="whitespace-pre-line text-ink-soft">{s.notes}</p>}
              </section>
            ))}
          </>
        )}

        {(appliances.length > 0 || manuals.length > 0) && (
          <>
            <H>Appliances & manuals</H>
            <ul className="flex flex-col gap-1.5 text-sm">
              {appliances.map((a) => (
                <li key={a.id}>
                  <strong>{a.name}</strong> {[a.brand, a.model, a.serialNumber && `S/N ${a.serialNumber}`].filter(Boolean).join(" · ")}
                  {a.warrantyExpiresOn && <span className="text-muted"> · warranty to {fmtDate(a.warrantyExpiresOn)}</span>}
                </li>
              ))}
              {manuals.map((d) => (
                <li key={d.id}>
                  📄 {d.fileId ? <a href={fileUrl(d.fileId)!} className="text-primary-700 underline">{d.title}</a> : d.title}
                  {d.applianceName && <span className="text-muted"> · {d.applianceName}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {paint.length > 0 && (
          <>
            <H>Paint colors</H>
            {paint.map((d) => (
              <section key={d.id} className="mb-3 text-sm">
                <h3 className="font-semibold">{d.title}</h3>
                {d.notes && <p className="whitespace-pre-line">{d.notes}</p>}
              </section>
            ))}
          </>
        )}

        {upkeep.length > 0 && (
          <>
            <H>Regular upkeep</H>
            <ul className="flex flex-col gap-1 text-sm">
              {upkeep.map((t) => (
                <li key={t.chore.id}>
                  <strong>{t.chore.title}</strong> · {t.rule ? describeRule(t.rule) : "as needed"}
                  {t.roomName && ` · ${t.roomName}`}
                  {t.chore.instructions && <span className="block text-ink-soft">{t.chore.instructions}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {petGroups.size > 0 && (
          <>
            <H>Pets</H>
            {[...petGroups.entries()].map(([name, notes]) => (
              <section key={name} className="mb-3 break-inside-avoid text-sm">
                <h3 className="text-base font-semibold">{name}</h3>
                {notes[0]!.vet && (
                  <p>
                    Vet: {notes[0]!.vet}
                    {notes[0]!.vetPhone && ` · ${notes[0]!.vetPhone}`}
                  </p>
                )}
                {notes.filter((n) => n.body).map((n, i) => (
                  <p key={i} className="whitespace-pre-line">
                    <span className="font-medium capitalize">{n.kind}:</span> {n.body}
                  </p>
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </article>
  );
}
