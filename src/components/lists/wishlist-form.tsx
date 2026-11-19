"use client";

import { Gift, Pencil } from "lucide-react";
import { saveWishlistItem } from "@/app/actions/wishlist";
import { FormModal } from "@/components/forms/action-form";
import { PRIORITY } from "@/lib/hub-shared";
import { FormRow, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";

export type WishDefaults = { id: string; title: string; link: string | null; priceCents: number | null; priority: number; details: string | null; occasion: string };

export function WishModal({ item, forMember, members, occasion }: { item?: WishDefaults; forMember?: MemberOption; members?: MemberOption[]; occasion?: string }) {
  const whose = forMember ? `${forMember.displayName.split(" ")[0]}'s` : "my";
  return (
    <FormModal
      title={item ? "Edit wish" : `Add to ${whose} wishlist`}
      triggerLabel={forMember ? `Add for ${forMember.displayName.split(" ")[0]}` : "Add a wish"}
      triggerIcon={<Gift className="size-4" />}
      triggerVariant={forMember ? "secondary" : "primary"}
      triggerSize={forMember ? "sm" : "md"}
      triggerContent={item ? <Pencil className="mx-auto size-4" /> : undefined}
      triggerAriaLabel={item ? `Edit ${item.title}` : undefined}
      triggerClassName={item ? "size-9 rounded-full text-muted hover:bg-sunken" : undefined}
      action={saveWishlistItem}
      size="sm"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {!item && forMember && <input type="hidden" name="memberId" value={forMember.id} />}
      {!item && !forMember && members && members.length > 1 && <SelectField name="memberId" label="Whose wishlist" options={members.map((m) => ({ value: m.id, label: m.displayName }))} />}
      <TextField name="title" label="What would you like?" required defaultValue={item?.title} placeholder="LEGO castle set" />
      <TextField name="link" label="Link (optional)" type="url" inputMode="url" defaultValue={item?.link ?? ""} placeholder="Paste a store link" />
      <FormRow>
        <TextField name="price" label="About how much ($)" inputMode="decimal" defaultValue={item?.priceCents != null ? (item.priceCents / 100).toFixed(2) : ""} />
        <SelectField name="priority" label="How much?" defaultValue={String(item?.priority ?? 2)} options={Object.entries(PRIORITY).map(([v, l]) => ({ value: v, label: l }))} />
      </FormRow>
      <TextAreaField name="details" label="Size, color, details" rows={2} defaultValue={item?.details ?? ""} placeholder="Size 8, blue, the one with the dragon" />
      <TextField name="occasion" label="Occasion" defaultValue={item?.occasion ?? occasion ?? "Holidays"} hint="Holidays, Birthday, Anytime…" />
    </FormModal>
  );
}
