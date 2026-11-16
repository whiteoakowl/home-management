"use client";

import { Camera } from "lucide-react";
import { saveProfilePhoto } from "@/app/actions/photos";
import { FormModal } from "@/components/forms/action-form";
import { ImageField } from "@/components/forms/fields";

/** Upload or change a family member's profile photo (shown on their avatar everywhere). */
export function ProfilePhotoButton({ memberId, currentUrl, label = "Photo" }: { memberId: string; currentUrl: string | null; label?: string }) {
  return (
    <FormModal title="Profile photo" action={saveProfilePhoto} triggerVariant="secondary" triggerIcon={<Camera className="size-4" />} triggerLabel={label} size="sm">
      <input type="hidden" name="memberId" value={memberId} />
      <ImageField name="image" label="Photo" currentUrl={currentUrl} />
    </FormModal>
  );
}
