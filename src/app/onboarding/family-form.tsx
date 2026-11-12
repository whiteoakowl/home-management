"use client";

import { useActionState } from "react";
import { createFamily } from "@/app/actions/family";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { TIMEZONES } from "@/lib/onboarding";

export function FamilyForm() {
  const [state, action] = useActionState(createFamily, undefined);
  const guessed = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const defaultTz = TIMEZONES.includes(guessed) ? guessed : "America/New_York";
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state?.message} />
      <Field label="Family name" htmlFor="familyName" error={state?.errors?.familyName}>
        <Input id="familyName" name="familyName" defaultValue="Vanderbilt" required autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time zone" htmlFor="timezone" error={state?.errors?.timezone}>
          <Select id="timezone" name="timezone" defaultValue={defaultTz}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ").replace("/", " / ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Town or city (optional)" htmlFor="locationName" hint="Used for weather and growing seasons.">
          <Input id="locationName" name="locationName" placeholder="e.g. Asheville, NC" />
        </Field>
      </div>
      <div className="mt-2 flex justify-end">
        <SubmitButton pendingLabel="Creating…">Create family</SubmitButton>
      </div>
    </form>
  );
}
