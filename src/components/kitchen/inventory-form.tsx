"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ScanBarcode } from "lucide-react";
import { saveInventoryItem } from "@/app/actions/kitchen";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, ImageField, NumberField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";

export const LOCATION_OPTIONS = [
  { value: "pantry", label: "Pantry" },
  { value: "fridge", label: "Refrigerator" },
  { value: "freezer", label: "Freezer" },
  { value: "supplies", label: "Kitchen supplies" },
  { value: "farm", label: "Farm storage" },
  { value: "garden", label: "Garden / root cellar" },
  { value: "pets", label: "Pet supplies" },
  { value: "craft", label: "Craft & ritual supplies" },
  { value: "home", label: "Home maintenance supplies" },
  { value: "other", label: "Other" },
];

export type InventoryDefaults = {
  id?: string;
  name?: string;
  quantity?: string | number;
  unit?: string | null;
  location?: string;
  spot?: string | null;
  categoryId?: string | null;
  purchasedOn?: string | null;
  expiresOn?: string | null;
  lowStockThreshold?: string | null;
  notes?: string | null;
  barcode?: string | null;
  brand?: string | null;
  productImageUrl?: string | null;
  imageUrl?: string | null;
};

/** Fields shared by the add/edit modal and the scan page form. */
export function InventoryFields({ d, categories }: { d?: InventoryDefaults; categories: { id: string; name: string }[] }) {
  return (
    <>
      {d?.id && <input type="hidden" name="id" value={d.id} />}
      {d?.barcode && <input type="hidden" name="barcode" value={d.barcode} />}
      {d?.brand && <input type="hidden" name="brand" value={d.brand} />}
      {d?.productImageUrl && <input type="hidden" name="productImageUrl" value={d.productImageUrl} />}
      <TextField name="name" label="Item" required defaultValue={d?.name} placeholder="Canned tomatoes" />
      <FormRow cols={3}>
        <NumberField name="quantity" label="Quantity" min={0} defaultValue={d?.quantity ?? 1} />
        <TextField name="unit" label="Unit" defaultValue={d?.unit ?? ""} placeholder="can, lb, dozen…" list="unit-suggestions" />
        <SelectField name="location" label="Where" defaultValue={d?.location ?? "pantry"} options={LOCATION_OPTIONS} />
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
}: {
  categories: { id: string; name: string }[];
  defaults?: InventoryDefaults;
  defaultOpen?: boolean;
  triggerContent?: ReactNode;
  triggerClassName?: string;
}) {
  return (
    <FormModal
      title={defaults?.id ? "Edit item" : "Add to inventory"}
      triggerLabel="Add item"
      action={saveInventoryItem}
      submitLabel={defaults?.id ? "Save" : "Add item"}
      defaultOpen={defaultOpen}
      triggerContent={triggerContent}
      triggerClassName={triggerClassName}
      description={
        !defaults?.id ? (
          <Link href="/kitchen/scan" className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:underline">
            <ScanBarcode className="size-4" /> Scan a barcode instead
          </Link>
        ) : undefined
      }
    >
      <InventoryFields d={{ location: defaults?.location, ...defaults }} categories={categories} />
    </FormModal>
  );
}
