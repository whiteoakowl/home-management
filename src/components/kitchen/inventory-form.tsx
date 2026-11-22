"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ScanBarcode } from "lucide-react";
import { saveInventoryItem } from "@/app/actions/kitchen";
import { FormModal } from "@/components/forms/action-form";
import { PANTRY_LOCATION_OPTIONS } from "@/lib/storage-places";
import { DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";

/** The Family Pantry's spots. Farm, garden, pet, home and craft supplies live in their own areas. */
export const LOCATION_OPTIONS = PANTRY_LOCATION_OPTIONS;

export type InventoryDefaults = {
  id?: string;
  name?: string;
  quantity?: string | number;
  unit?: string | null;
  location?: string;
  storageAreaId?: string | null;
  spot?: string | null;
  categoryId?: string | null;
  purchasedOn?: string | null;
  expiresOn?: string | null;
  lowStockThreshold?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  barcode?: string | null;
  brand?: string | null;
  productImageUrl?: string | null;
  imageUrl?: string | null;
};

/** Fields shared by the add/edit modal and the scan page form. */
export function InventoryFields({ d, categories, locations = LOCATION_OPTIONS }: { d?: InventoryDefaults; categories: { id: string; name: string }[]; locations?: { value: string; label: string }[] }) {
  const fixed = locations.length === 1;
  return (
    <>
      {fixed && <input type="hidden" name="location" value={locations[0]!.value} />}
      {d?.storageAreaId && <input type="hidden" name="storageAreaId" value={d.storageAreaId} />}
      {d?.id && <input type="hidden" name="id" value={d.id} />}
      {d?.barcode && <input type="hidden" name="barcode" value={d.barcode} />}
      {d?.brand && <input type="hidden" name="brand" value={d.brand} />}
      {d?.productImageUrl && <input type="hidden" name="productImageUrl" value={d.productImageUrl} />}
      <TextField name="name" label="Item" required defaultValue={d?.name} placeholder="Canned tomatoes" />
      <TextField name="tags" label="Also called (optional)" defaultValue={(d?.tags ?? []).join(", ")} placeholder="poultry, chicken breasts" hint="Other names recipes use for it, separated by commas, so they find it in stock." />
      <FormRow cols={fixed ? 2 : 3}>
        <NumberField name="quantity" label="Quantity" min={0} defaultValue={d?.quantity ?? 1} />
        <TextField name="unit" label="Unit" defaultValue={d?.unit ?? ""} placeholder="can, lb, dozen…" list="unit-suggestions" />
        {!fixed && <SelectField name="location" label="Where" defaultValue={d?.location && locations.some((l) => l.value === d.location) ? d.location : locations[0]!.value} options={locations} />}
      </FormRow>
      <datalist id="unit-suggestions">
        {["each", "can", "jar", "box", "bag", "bottle", "lb", "oz", "g", "kg", "cup", "dozen", "gal", "qt", "roll", "pack"].map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <FormRow>
        <DateField name="expiresOn" label="Expires" defaultValue={d?.expiresOn ?? ""} />
        <DateField name="purchasedOn" label="Purchased" defaultValue={d?.purchasedOn ?? ""} />
        {categories.length > 0 && <SelectField name="categoryId" label="Category" defaultValue={d?.categoryId ?? ""} placeholder="None" options={categories.map((c) => ({ value: c.id, label: c.name }))} />}
        <TextField name="spot" label="Shelf / spot" defaultValue={d?.spot ?? ""} placeholder="Top shelf, chest freezer…" />
        <NumberField name="lowStockThreshold" label="Low-stock alert at" min={0} defaultValue={d?.lowStockThreshold ?? ""} hint="Adds it to the shopping list when it gets this low." />
      </FormRow>
      <ImageField currentUrl={d?.imageUrl ?? d?.productImageUrl} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={d?.notes ?? ""} />
    </>
  );
}

export function InventoryFormModal({
  categories,
  defaults,
  defaultOpen,
  triggerContent,
  triggerClassName,
  privateSpace,
  locations,
  title,
  triggerLabel = "Add Food",
}: {
  categories: { id: string; name: string }[];
  /** Storage spots to offer; one = fixed (farm storage, root cellar…). Defaults to the pantry's. */
  locations?: { value: string; label: string }[];
  title?: string;
  triggerLabel?: string;
  defaults?: InventoryDefaults;
  defaultOpen?: boolean;
  /** Add to the member's own private pantry instead of the family's. */
  privateSpace?: boolean;
  triggerContent?: ReactNode;
  triggerClassName?: string;
}) {
  return (
    <FormModal
      title={defaults?.id ? "Edit item" : (title ?? (privateSpace ? "Add to My Pantry" : "Add to the Family Pantry"))}
      triggerLabel={triggerLabel}
      action={saveInventoryItem}
      submitLabel={defaults?.id ? "Save" : locations ? "Add" : "Add food"}
      defaultOpen={defaultOpen}
      triggerContent={triggerContent}
      triggerClassName={triggerClassName}
      description={
        !defaults?.id && !locations ? (
          <Link href={privateSpace ? "/kitchen/scan?space=mine" : "/kitchen/scan"} className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:underline">
            <ScanBarcode className="size-4" /> Scan a barcode instead
          </Link>
        ) : undefined
      }
    >
      {privateSpace && !defaults?.id && <input type="hidden" name="space" value="mine" />}
      <InventoryFields d={{ location: defaults?.location, ...defaults }} categories={categories} locations={locations} />
    </FormModal>
  );
}
