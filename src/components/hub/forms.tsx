"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, ImageUp, Pencil, SendHorizontal, UserPlus } from "lucide-react";
import { addPhotosToAlbum, saveAlbum, saveContact, sendMessage } from "@/app/actions/hub";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, PhotosField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/ui/form";
import { CONTACT_CATEGORIES, CONTACT_LABEL } from "@/lib/hub-shared";

const editIcon = <Pencil className="mx-auto size-4" />;
const iconBtn = "size-9 rounded-full text-muted hover:bg-sunken";

// ─── Chat ────────────────────────────────────────────────────────────────────

/** Keeps the chat fresh (every few seconds while the tab is visible) and scrolled to the newest message. */
export function ChatLive({ latest }: { latest: string }) {
  const router = useRouter();
  useEffect(() => {
    const h = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 8000);
    return () => window.clearInterval(h);
  }, [router]);
  useEffect(() => {
    document.getElementById("chat-end")?.scrollIntoView({ block: "end" });
  }, [latest]);
  return null;
}

export function ChatComposer() {
  const [key, setKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  return (
    <ActionForm
      key={key}
      action={sendMessage}
      onSuccess={() => {
        setPhoto(null);
        setKey((k) => k + 1);
      }}
      className="gap-2"
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Photo to send" className="h-24 w-fit rounded-xl object-cover" />
      )}
      <div className="flex items-end gap-2">
        <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-muted hover:bg-sunken" aria-label="Add a photo" title="Add a photo">
          <ImagePlus className="size-5" />
          <input
            type="file"
            name="photo"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              setPhoto(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
        <textarea
          ref={textRef}
          name="body"
          rows={1}
          autoFocus
          placeholder="Message the family…"
          aria-label="Message"
          maxLength={4000}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] outline-none focus:border-primary-400"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${t.scrollHeight}px`;
          }}
        />
        <SubmitButton pendingLabel=" " aria-label="Send" className="size-11 shrink-0 rounded-full p-0">
          <SendHorizontal className="size-5" />
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

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

export function AlbumModal({ item }: { item?: { id: string; title: string; description: string | null; eventDate: string | null } }) {
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
    </FormModal>
  );
}

export function AddPhotosModal({ albumId }: { albumId: string }) {
  return (
    <FormModal title="Add photos" triggerLabel="Add photos" triggerIcon={<ImageUp className="size-4" />} action={addPhotosToAlbum} submitLabel="Upload" size="sm">
      <input type="hidden" name="albumId" value={albumId} />
      <PhotosField name="photos" label="Photos" required max={20} />
      <TextField name="caption" label="Caption (optional)" maxLength={200} />
    </FormModal>
  );
}
