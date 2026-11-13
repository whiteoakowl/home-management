import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { saveMedicalRecord } from "@/app/actions/medical";
import { RecordModal } from "@/components/forms/config-form";
import { MedicalRecordCard } from "@/components/medical/record-card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { listMedical } from "@/lib/medical";
import { DOC_CATEGORIES, KIND_LABEL, MEDICAL_FIELDS, type MedicalKind } from "@/lib/medical-config";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import type { FieldDef } from "@/lib/record-fields";
import { MedicalDisclaimer, MedicalTabs } from "./medical-tabs";

export async function medicalViewer() {
  const viewer = await getViewer();
  if (!viewer.can("medical")) redirect("/");
  return viewer;
}

export const forField = (_members?: unknown): FieldDef => ({ name: "memberId", label: "For", type: "member", required: true, full: true });

/** Shared list page for allergies / restrictions / conditions / medications / documents. */
export async function MedicalKindPage({
  kind,
  title,
  description,
  icon,
  sp,
}: {
  kind: Exclude<MedicalKind, "profile">;
  title: string;
  description: string;
  icon: React.ReactNode;
  sp: { member?: string; q?: string; category?: string; status?: string };
}) {
  const viewer = await medicalViewer();
  const canEdit = viewer.can("medical", "edit");
  const [members, rowsAll] = await Promise.all([memberOptions(viewer), listMedical(viewer, kind)]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = rowsAll.filter(({ r }) => {
    const rec = r as Record<string, unknown>;
    if (sp.member && rec.memberId !== sp.member) return false;
    if (kind === "document" && sp.category && rec.category !== sp.category) return false;
    if ((kind === "medication" || kind === "condition") && sp.status !== "all" && rec.active === false) return false;
    if (q && !JSON.stringify(rec).toLowerCase().includes(q)) return false;
    return true;
  });
  const access = await getRecordAccess("medical", rows.map(({ r }) => r.id));
  const label = KIND_LABEL[kind];
  const add = canEdit ? (
    <RecordModal
      title={`Add ${label.toLowerCase()}`}
      action={saveMedicalRecord}
      fields={[forField(members), ...MEDICAL_FIELDS[kind]]}
      defaults={{ memberId: sp.member ?? null, active: true }}
      hidden={{ kind }}
      members={members}
      visibility={{ defaultValue: "private", privateLabel: "Private (patient & parents)" }}
    />
  ) : undefined;
  const filterBase = "inline-flex h-9 items-center rounded-full px-3 text-sm";
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  return (
    <>
      <PageHeader eyebrow="Medical" title={title} description={description} actions={add} />
      <MedicalTabs active={kind} />
      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search {title.toLowerCase()}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={sp.q} placeholder={`Search ${title.toLowerCase()}…`} className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-9 text-sm" />
        </label>
        <select name="member" defaultValue={sp.member ?? ""} aria-label="Family member" className="h-10 rounded-full border border-line-strong bg-surface px-3 text-sm">
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
        {kind === "document" && (
          <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className="h-10 rounded-full border border-line-strong bg-surface px-3 text-sm">
            <option value="">All categories</option>
            {DOC_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        {(kind === "medication" || kind === "condition") && (
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="h-10 rounded-full border border-line-strong bg-surface px-3 text-sm">
            <option value="">{kind === "medication" ? "Currently taking" : "Active"}</option>
            <option value="all">All, including past</option>
          </select>
        )}
        <button className={`${filterBase} h-10 bg-ink px-4 font-medium text-white`}>Filter</button>
        {(sp.q || sp.member || sp.category || sp.status) && (
          <a href={href({ q: undefined, member: undefined, category: undefined, status: undefined })} className={`${filterBase} text-muted hover:bg-sunken`}>
            Clear
          </a>
        )}
      </form>
      {rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ r, memberName, memberColor }) => (
            <MedicalRecordCard
              key={r.id}
              kind={kind}
              r={r as never}
              member={{ displayName: memberName, color: memberColor }}
              members={members}
              canEdit={canEdit}
              sharedWith={access.get(r.id) ?? []}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={icon}
            title={rowsAll.length ? "Nothing matches those filters" : `No ${title.toLowerCase()} recorded`}
            description={rowsAll.length ? "Try clearing the search or choosing another person." : "Records you add are private to the patient and parents unless you share them."}
            action={!rowsAll.length && add}
          />
        </div>
      )}
      <MedicalDisclaimer />
    </>
  );
}
