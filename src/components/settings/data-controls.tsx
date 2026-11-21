"use client";

import { Trash2 } from "lucide-react";
import { deleteFamilyAccount } from "@/app/actions/delete-account";
import { FormModal } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";

/** Account holder: delete the family for good (downloads are in DownloadCenter). */
export function DataControls({ familyName }: { familyName: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <FormModal
        title="Delete the family account?"
        description="This can't be undone."
        triggerLabel="Delete our family account"
        triggerVariant="danger"
        triggerIcon={<Trash2 className="size-4" />}
        action={deleteFamilyAccount}
        submitLabel="Delete everything permanently"
        size="sm"
      >
        <div className="flex flex-col gap-2 rounded-xl bg-wine-50 p-3 text-sm text-wine-800">
          <p>
            This permanently deletes the <strong>{familyName}</strong> family: every calendar, chore, list, recipe, photo, message and record, and the logins of everyone in the family.
          </p>
          <p>Your subscription is cancelled right away and you won&apos;t be charged again. Consider downloading your data first.</p>
        </div>
        <TextField name="familyName" label={`Type your family's name (${familyName}) to confirm`} autoComplete="off" required />
        <TextField name="password" label="Your password" type="password" autoComplete="current-password" required />
      </FormModal>
    </div>
  );
}
