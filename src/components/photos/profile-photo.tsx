"use client";

import { Camera } from "lucide-react";
import { saveMainPhoto, saveProfilePhoto } from "@/app/actions/photos";
import { FormModal } from "@/components/forms/action-form";
import { ImageField } from "@/components/forms/fields";

/** Upload or change a family member's profile photo (shown on their avatar everywhere). */
export function ProfilePhotoButton({ memberId, currentUrl, label = "Photo" }: { memberId: string; currentUrl: string | null; label?: string }) {
  return (
    <FormModal title="Profile photo" action={saveProfilePhoto} refreshOnSuccess triggerVariant="secondary" triggerIcon={<Camera className="size-4" />} triggerLabel={label} size="sm">
      <input type="hidden" name="memberId" value={memberId} />
      <ImageField name="image" label="Photo" currentUrl={currentUrl} />
    </FormModal>
  );
}

/** Upload or change a pet's / animal's main photo. */
export function MainPhotoButton({ kind, entityId, currentUrl, name }: { kind: "pet" | "animal"; entityId: string; currentUrl: string | null; name: string }) {
  return (
    <FormModal title={`Photo of ${name}`} action={saveMainPhoto} refreshOnSuccess triggerVariant="secondary" triggerIcon={<Camera className="size-4" />} triggerLabel={currentUrl ? "Change photo" : "Add photo"} size="sm">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="entityId" value={entityId} />
      <ImageField name="image" label="Photo" currentUrl={currentUrl} />
    </FormModal>
  );
}
