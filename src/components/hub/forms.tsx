"use client";

import { ImagePlus, ImageUp, Pencil, UserPlus } from "lucide-react";
import { addPhotosToAlbum, saveAlbum, saveContact } from "@/app/actions/hub";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, PhotosField, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";
import { VideoField } from "@/components/photos/video-field";
import { CONTACT_CATEGORIES, CONTACT_LABEL } from "@/lib/hub-shared";

const editIcon = <Pencil className="mx-auto size-4" />;
const iconBtn = "size-9 rounded-full text-muted hover:bg-sunken";

// ─── Contacts ────────────────────────────────────────────────────────────────

export type ContactDefaults = {
  id: string;
  name: string;
  category: string;
  relationship: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  birthday: string | null;
  notes: string | null;
  favorite: boolean;
  private: boolean;
  mine: boolean;
};

export function ContactModal({ item, defaultCategory }: { item?: ContactDefaults; defaultCategory?: string }) {
  return (
    <FormModal
      title={item ? `Edit ${item.name}` : "Add a contact"}
      triggerLabel="Add contact"
      triggerIcon={<UserPlus className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? `Edit ${item.name}` : undefined}
      triggerClassName={item ? iconBtn : undefined}
      action={saveContact}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="name" label="Name" required defaultValue={item?.name} placeholder="Ms. Garcia" />
        <SelectField name="category" label="Group" defaultValue={item?.category ?? defaultCategory ?? "friends"} options={CONTACT_CATEGORIES.map((c) => ({ value: c, label: CONTACT_LABEL[c]! }))} />
      </FormRow>
      <TextField name="relationship" label="Who they are" defaultValue={item?.relationship ?? ""} placeholder="2nd grade teacher, Grandma, plumber…" />
      <FormRow>
        <TextField name="phone" label="Phone" type="tel" defaultValue={item?.phone ?? ""} />
        <TextField name="altPhone" label="Other phone" type="tel" defaultValue={item?.altPhone ?? ""} />
      </FormRow>
      <FormRow>
        <TextField name="email" label="Email" type="email" defaultValue={item?.email ?? ""} />
        <DateField name="birthday" label="Birthday" defaultValue={item?.birthday ?? ""} hint="Shows on the family calendar." />
      </FormRow>
      <TextAreaField name="address" label="Address" rows={2} defaultValue={item?.address ?? ""} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} placeholder="Kids' names, gate code, allergies…" />
      <CheckboxField name="favorite" label="Favorite" description="Pinned to the top of the list." defaultChecked={item?.favorite} />
      {(!item || item.mine) && <CheckboxField name="private" label="Only me" description="Keep this contact private to you." defaultChecked={item?.private} />}
    </FormModal>
  );
}

// ─── Photo albums ────────────────────────────────────────────────────────────

export type AlbumDefaults = { id: string; title: string; description: string | null; eventDate: string | null; ownerMemberId?: string | null; private?: boolean };

export function AlbumModal({ item, members }: { item?: AlbumDefaults; members?: MemberOption[] }) {
  return (
    <FormModal
      title={item ? "Edit album" : "New album"}
      triggerLabel="New album"
      triggerIcon={<ImagePlus className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? "Edit album" : undefined}
      triggerClassName={item ? iconBtn : undefined}
      action={saveAlbum}
      size="sm"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <TextField name="title" label="Album name" required defaultValue={item?.title} placeholder="Beach trip 2026" />
      <DateField name="eventDate" label="Date (optional)" defaultValue={item?.eventDate ?? ""} />
      <TextAreaField name="description" label="Description" rows={2} defaultValue={item?.description ?? ""} />
      {members && members.length > 0 && (
        <SelectField name="ownerMemberId" label="Whose album" defaultValue={item?.ownerMemberId ?? ""} placeholder="The whole family's" options={members.map((m) => ({ value: m.id, label: `${m.displayName.split(" ")[0]}'s album` }))} />
      )}
      <CheckboxField name="private" label="Only me" description="A private album only you can see." defaultChecked={item?.private} />
    </FormModal>
  );
}

export function AddPhotosModal({ albumId }: { albumId: string }) {
  return (
    <FormModal title="Add photos & videos" triggerLabel="Add photos" triggerIcon={<ImageUp className="size-4" />} action={addPhotosToAlbum} submitLabel="Upload" size="sm" refreshOnSuccess>
      <input type="hidden" name="albumId" value={albumId} />
      <PhotosField name="photos" label="Photos" max={20} />
      <VideoField />
      <TextField name="caption" label="Caption (optional)" maxLength={200} />
      <TextField name="milestone" label="Milestone (optional)" maxLength={120} placeholder="First day of kindergarten" hint="Shows on the family timeline with a ⭐." />
    </FormModal>
  );
}
