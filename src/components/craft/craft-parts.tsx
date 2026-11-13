import Link from "next/link";
import { Heart } from "lucide-react";
import { saveCraftItem } from "@/app/actions/craft";
import { RecordModal } from "@/components/forms/config-form";
import { ChipSelect, SelectField, type MemberOption } from "@/components/forms/fields";
import { Badge } from "@/components/ui/display";
import { fileUrl } from "@/lib/files";
import { CRAFT_COLUMNS, CRAFT_FIELDS, CRAFT_META, MOON_OPTIONS, SABBAT_OPTIONS, SAFETY_LABEL, SAFETY_TONE, type CraftKind } from "@/lib/craft-config";
import type { FieldValue } from "@/lib/record-fields";
import type { craftItems } from "@/db/schema";

type Item = typeof craftItems.$inferSelect;

export function craftValues(it: Item): Record<string, FieldValue> {
  const v: Record<string, FieldValue> = { ...it.fields };
  for (const c of CRAFT_COLUMNS) v[c] = (it as Record<string, unknown>)[c] as FieldValue;
  return v;
}

export function CraftItemModal({
  kind,
  item,
  members,
  supplies,
  supplyIds,
  plants,
  label,
}: {
  kind: CraftKind;
  item?: Item;
  members: MemberOption[];
  supplies?: { id: string; name: string }[];
  supplyIds?: string[];
  plants?: { id: string; name: string }[];
  label?: string;
}) {
  const meta = CRAFT_META[kind];
  return (
    <RecordModal
      title={item ? `Edit ${meta.label.toLowerCase()}` : `New ${meta.label.toLowerCase()}`}
      triggerLabel={label ?? (item ? "Edit" : `Add ${meta.label.toLowerCase()}`)}
      triggerVariant={item ? "secondary" : "primary"}
      action={saveCraftItem}
      fields={CRAFT_FIELDS[kind]}
      defaults={item ? craftValues(item) : kind === "herb" ? { category: "caution" } : {}}
      hidden={{ kind, ...(item ? { id: item.id } : {}) }}
      members={members}
      imageUrls={{ image: item ? fileUrl(item.imageFileId) : null }}
      visibility={{ defaultValue: item?.visibility ?? "family", privateLabel: "Only me" }}
      extra={
        <>
          {(kind === "spell" || kind === "ritual") && supplies && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium text-ink-soft">Supplies from your inventory</legend>
              <input type="hidden" name="supplyIdsField" value="1" />
              {supplies.length ? (
                <ChipSelect name="supplyIds" options={supplies.map((s) => ({ value: s.id, label: s.name }))} defaultValue={supplyIds} />
              ) : (
                <p className="text-sm text-muted">Add candles, herbs and other supplies on the Supplies page to link them here.</p>
              )}
            </fieldset>
          )}
          {kind === "herb" && plants && (
            <SelectField name="plantId" label="Grows in our garden as" defaultValue={item?.plantId ?? ""} placeholder="Not linked" options={plants.map((p) => ({ value: p.id, label: p.name }))} />
          )}
        </>
      }
    />
  );
}

export function CraftCard({ it, owned }: { it: Item; owned?: number }) {
  const img = fileUrl(it.imageFileId, true);
  const moon = it.moonPhase ? MOON_OPTIONS.find((m) => m.value === it.moonPhase)?.label : null;
  const sabbat = it.sabbat ? SABBAT_OPTIONS.find((s) => s.value === it.sabbat)?.label : null;
  return (
    <Link href={`/witchcraft/item/${it.id}`} className="group flex gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 to-mist-50 text-3xl">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{it.emoji ?? CRAFT_META[it.kind as CraftKind]?.emoji}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-semibold group-hover:text-primary-700">
          <span className="truncate">{it.name}</span>
          {it.isFavorite && <Heart className="size-3.5 shrink-0 fill-wine-500 text-wine-500" aria-label="Favorite" />}
        </p>
        {it.description && <p className="line-clamp-2 text-sm text-muted">{it.description}</p>}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {it.kind === "herb" && it.category && <Badge tone={SAFETY_TONE[it.category] ?? "neutral"}>{SAFETY_LABEL[it.category] ?? it.category}</Badge>}
          {it.kind !== "herb" && it.category && <Badge tone="primary">{it.category.replace(/_/g, " ")}</Badge>}
          {moon && <Badge tone="mist">🌙 {moon}</Badge>}
          {sabbat && <Badge tone="olive">{sabbat}</Badge>}
          {!it.familyId && <Badge>Reference</Badge>}
          {owned ? <Badge tone="olive">In collection ×{owned}</Badge> : null}
        </div>
      </div>
    </Link>
  );
}
