import { Check, FileText, Minus, Plus, ShoppingBasket } from "lucide-react";
import {
  adjustPetSupply,
  deletePetMemory,
  deletePetRecord,
  deletePetSupply,
  markPreventativeGiven,
  saveCareNote,
  savePetMemory,
  savePetRecord,
  savePetSupply,
  savePreventative,
  shopForPetSupply,
} from "@/app/actions/pets";
import { FormModal } from "@/components/forms/action-form";
import { RecordModal } from "@/components/forms/config-form";
import { DateField, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { DetailList, fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Avatar, Badge } from "@/components/ui/display";
import { addDays } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { CARE_NOTE_FIELDS, CARE_NOTE_KINDS, PET_RECORD_FIELDS, PET_RECORD_KINDS, PREVENTATIVE_FIELDS, PREVENTATIVE_KINDS, SUPPLY_FIELDS, SUPPLY_KINDS } from "@/lib/pets-config";
import type { FieldDef, FieldValue } from "@/lib/record-fields";
import { cn } from "@/lib/utils";

const label = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
const defaultsFrom = (fields: FieldDef[], r: Record<string, unknown>) => Object.fromEntries(fields.map((f) => [f.name, r[f.name] as FieldValue]));
const budgetField: FieldDef = { name: "addToBudget", label: "Also record the cost as a budget expense (Pets)", type: "checkbox" };

// ─── Medical records ─────────────────────────────────────────────────────────

type Rec = { id: string; petId: string; kind: string; title: string; date: string; veterinarian: string | null; costCents: number | null; nextDueOn: string | null; description: string | null; notes: string | null; fileId: string | null };

export function PetRecordModal({ petId, canBudget, r }: { petId: string; canBudget?: boolean; r?: Rec }) {
  return (
    <RecordModal
      title={r ? "Edit medical record" : "Add medical record"}
      triggerLabel="Medical record"
      triggerVariant={r ? undefined : "soft"}
      edit={!!r}
      action={savePetRecord}
      fields={r || !canBudget ? PET_RECORD_FIELDS : [...PET_RECORD_FIELDS, budgetField]}
      defaults={r ? defaultsFrom(PET_RECORD_FIELDS, r) : { kind: "vet_visit" }}
      hidden={{ petId, ...(r ? { id: r.id } : {}) }}
    />
  );
}

export function PetRecordRow({ r, canEdit, petName }: { r: Rec; canEdit: boolean; petName?: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{fmtDate(r.date)}</p>
        <p className="font-medium">
          {r.title} <Badge tone="primary">{label(PET_RECORD_KINDS, r.kind)}</Badge> {petName && <span className="text-sm font-normal text-muted">· {petName}</span>}
        </p>
        <p className="text-sm text-muted">
          {[r.veterinarian, r.costCents ? fmtMoney(r.costCents) : null, r.nextDueOn ? `Next due ${fmtDate(r.nextDueOn)}` : null].filter(Boolean).join(" · ")}
        </p>
        {r.description && <p className="mt-1 text-sm whitespace-pre-line">{r.description}</p>}
        {r.notes && <p className="mt-1 text-sm whitespace-pre-line text-muted">{r.notes}</p>}
        {r.fileId && (
          <a href={fileUrl(r.fileId)!} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 underline">
            <FileText className="size-4" aria-hidden /> Attachment
          </a>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0">
          <PetRecordModal petId={r.petId} r={r} />
          <DeleteButton action={deletePetRecord} fields={{ kind: "medical", id: r.id }} what="this record" />
        </div>
      )}
    </li>
  );
}

// ─── Preventatives ───────────────────────────────────────────────────────────

type Prev = { id: string; petId: string; kind: string; productName: string; brand: string | null; lastGivenOn: string | null; intervalDays: number; nextDueOn: string | null; assigneeId: string | null; notes: string | null };

export function PreventativeModal({ petId, members, p }: { petId: string; members: MemberOption[]; p?: Prev }) {
  return (
    <RecordModal
      title={p ? "Edit preventative" : "Add preventative"}
      triggerLabel="Preventative"
      triggerVariant={p ? undefined : "soft"}
      edit={!!p}
      action={savePreventative}
      fields={PREVENTATIVE_FIELDS}
      defaults={p ? defaultsFrom(PREVENTATIVE_FIELDS, p) : { intervalDays: 30 }}
      hidden={{ petId, ...(p ? { id: p.id } : {}) }}
      members={members}
    />
  );
}

export function PreventativeRow({ p, today, members, canEdit, petName }: { p: Prev; today: string; members: MemberOption[]; canEdit: boolean; petName?: string }) {
  const overdue = p.nextDueOn && p.nextDueOn < today;
  const dueSoon = p.nextDueOn && !overdue && p.nextDueOn <= addDays(today, 7);
  const who = members.find((m) => m.id === p.assigneeId);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="min-w-56 flex-1">
        <p className="font-medium">
          {p.productName} <Badge tone="primary">{label(PREVENTATIVE_KINDS, p.kind)}</Badge> {petName && <span className="text-sm font-normal text-muted">· {petName}</span>}
        </p>
        <p className={cn("text-sm", overdue ? "font-medium text-wine-600" : dueSoon ? "font-medium text-olive-700" : "text-ink-soft")}>
          {p.nextDueOn ? `${overdue ? "Overdue since" : "Next due"} ${fmtDate(p.nextDueOn)}` : "No due date"}
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          {[`Every ${p.intervalDays} days`, p.lastGivenOn ? `last given ${fmtDate(p.lastGivenOn)}` : null].filter(Boolean).join(" · ")}
          {who && (
            <span className="inline-flex items-center gap-1">
              · <Avatar name={who.displayName} color={who.color} size="xs" /> {who.displayName}
            </span>
          )}
        </p>
      </div>
      {canEdit && (
        <div className="flex items-center">
          <ActionButton action={markPreventativeGiven} fields={{ id: p.id }} className="mr-1 h-9 rounded-full bg-primary-50 px-3 text-sm font-medium text-primary-700 hover:bg-primary-100">
            <Check className="size-4" aria-hidden /> Given today
          </ActionButton>
          <PreventativeModal petId={p.petId} members={members} p={p} />
          <DeleteButton action={deletePetRecord} fields={{ kind: "preventative", id: p.id }} what="this preventative" />
        </div>
      )}
    </li>
  );
}

// ─── Food & supplies ─────────────────────────────────────────────────────────

type Supply = {
  s: { id: string; petId: string | null; kind: string; brand: string | null; foodType: string | null; flavor: string | null; feedingInstructions: string | null; feedingSchedule: string | null; dietaryNotes: string | null };
  item: { id: string; name: string; quantity: string; unit: string | null; lowStockThreshold: string | null };
  petName?: string | null;
};

export function SupplyModal({ petId, pets, x }: { petId?: string; pets?: { id: string; name: string }[]; x?: Supply }) {
  const petField: FieldDef[] = !petId && pets?.length ? [{ name: "petId", label: "For", type: "select", options: pets.map((p) => ({ value: p.id, label: p.name })), hint: "Leave blank for shared supplies." }] : [];
  return (
    <RecordModal
      title={x ? "Edit supply" : "Add food or supply"}
      triggerLabel="Food or supply"
      triggerVariant={x ? undefined : "soft"}
      edit={!!x}
      action={savePetSupply}
      fields={[...petField, ...SUPPLY_FIELDS]}
      defaults={
        x
          ? { ...defaultsFrom(SUPPLY_FIELDS, x.s), name: x.item.name, quantity: Number(x.item.quantity), unit: x.item.unit, lowStockThreshold: x.item.lowStockThreshold === null ? null : Number(x.item.lowStockThreshold), petId: x.s.petId }
          : { kind: "food", quantity: 1 }
      }
      hidden={{ ...(petId !== undefined ? { petId } : {}), ...(x ? { id: x.s.id } : {}) }}
    />
  );
}

export function SupplyCard({ x, canEdit, canShop, showPet }: { x: Supply; canEdit: boolean; canShop: boolean; showPet?: boolean }) {
  const q = Number(x.item.quantity);
  const low = x.item.lowStockThreshold !== null && q <= Number(x.item.lowStockThreshold);
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{[x.s.brand, x.item.name].filter(Boolean).join(" ")}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="primary">{label(SUPPLY_KINDS, x.s.kind)}</Badge>
            {showPet && <Badge tone="mist">{x.petName ?? "Shared"}</Badge>}
            {low && <Badge tone="wine">Low stock</Badge>}
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0">
            <SupplyModal x={x} petId={x.s.petId ?? ""} />
            <DeleteButton action={deletePetSupply} fields={{ id: x.s.id }} what="this supply" />
          </div>
        )}
      </header>
      <div className="flex items-center gap-2">
        {canEdit && (
          <ActionButton action={adjustPetSupply} fields={{ id: x.s.id, delta: -1 }} label="Use one" className="size-8 rounded-full border border-line hover:bg-sunken">
            <Minus className="size-4" />
          </ActionButton>
        )}
        <span className="min-w-20 text-center text-sm">
          <strong className="text-base">{q}</strong> {x.item.unit ?? "on hand"}
        </span>
        {canEdit && (
          <ActionButton action={adjustPetSupply} fields={{ id: x.s.id, delta: 1 }} label="Add one" className="size-8 rounded-full border border-line hover:bg-sunken">
            <Plus className="size-4" />
          </ActionButton>
        )}
        {canShop && (
          <ActionButton action={shopForPetSupply} fields={{ id: x.s.id }} className="ml-auto h-8 rounded-full bg-primary-50 px-3 text-xs font-semibold text-primary-700 hover:bg-primary-100">
            <ShoppingBasket className="size-3.5" aria-hidden /> Add to shopping
          </ActionButton>
        )}
      </div>
      <DetailList fields={SUPPLY_FIELDS} values={{ ...x.s }} skip={["name", "kind", "brand", "quantity", "unit", "lowStockThreshold"]} />
    </article>
  );
}

// ─── Care notes ──────────────────────────────────────────────────────────────

export function CareNoteModal({ petId, n }: { petId: string; n?: { id: string; kind: string; body: string } }) {
  return (
    <RecordModal
      title={n ? "Edit care note" : "Add special care note"}
      triggerLabel="Care note"
      triggerVariant={n ? undefined : "soft"}
      edit={!!n}
      size="md"
      action={saveCareNote}
      fields={CARE_NOTE_FIELDS}
      defaults={n ?? { kind: "feeding" }}
      hidden={{ petId, ...(n ? { id: n.id } : {}) }}
    />
  );
}

export function CareNoteCard({ n, petId, canEdit }: { n: { id: string; kind: string; body: string }; petId: string; canEdit: boolean }) {
  return (
    <li className={cn("rounded-xl border p-3", n.kind === "emergency" ? "border-wine-200 bg-wine-50" : "border-line bg-surface")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label(CARE_NOTE_KINDS, n.kind)}</p>
          <p className="mt-1 text-sm whitespace-pre-line">{n.body}</p>
        </div>
        {canEdit && (
          <div className="flex shrink-0">
            <CareNoteModal petId={petId} n={n} />
            <DeleteButton action={deletePetRecord} fields={{ kind: "care", id: n.id }} what="this note" />
          </div>
        )}
      </div>
    </li>
  );
}

// ─── Memories ────────────────────────────────────────────────────────────────

export function MemoryModal({ petId, members, today }: { petId: string; members: MemberOption[]; today: string }) {
  return (
    <FormModal title="Add a memory" action={savePetMemory} triggerLabel="Memory" triggerVariant="soft" size="lg" submitLabel="Save memory">
      <input type="hidden" name="petId" value={petId} />
      <TextField name="title" label="Title" placeholder="First snow day" />
      <DateField name="date" label="Date" defaultValue={today} />
      <TextAreaField name="body" label="What happened" rows={4} required />
      <TextField name="category" label="Milestone (optional)" placeholder="Adoption day, birthday, achievement…" />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
        Photos
        <input type="file" name="photos" accept="image/*" multiple className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
      </label>
      <VisibilityField members={members} defaultValue="family" />
    </FormModal>
  );
}

export function MemoryItem({
  m,
  canDelete,
  petName,
}: {
  m: { id: string; date: string; title: string | null; body: string; category: string | null; photos: string[] };
  canDelete: boolean;
  petName?: string;
}) {
  return (
    <li className="relative pl-6">
      <span className="absolute top-1.5 left-0 size-3 rounded-full bg-primary-400 ring-4 ring-primary-50" aria-hidden />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            {fmtDate(m.date)}
            {petName && ` · ${petName}`}
            {m.category && (
              <>
                {" "}
                <Badge tone="olive">{m.category}</Badge>
              </>
            )}
          </p>
          {m.title && <p className="font-semibold">{m.title}</p>}
          <p className="mt-1 text-sm whitespace-pre-line">{m.body}</p>
          {m.photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {m.photos.map((id) => (
                <a key={id} href={fileUrl(id)!} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(id, true)!} alt="" className="size-24 rounded-xl object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
        {canDelete && <DeleteButton action={deletePetMemory} fields={{ id: m.id }} what="this memory" />}
      </div>
    </li>
  );
}
