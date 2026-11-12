"use client";

import { useActionState } from "react";
import { updateEnabledModules, updateFamily } from "@/app/actions/family";
import { Field, FormMessage, Input, Select, SubmitButton, Toggle } from "@/components/ui/form";
import { MODULES } from "@/db/schema/_shared";
import { MODULE_META } from "@/lib/modules";
import { TIMEZONES } from "@/lib/onboarding";

export function FamilyDetailsForm({
  family,
}: {
  family: { name: string; timezone: string; locationName: string | null; latitude: number | null; longitude: number | null };
}) {
  const [state, action] = useActionState(updateFamily, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Family name" htmlFor="familyName" error={state?.errors?.familyName}>
          <Input id="familyName" name="familyName" defaultValue={family.name} required />
        </Field>
        <Field label="Time zone" htmlFor="timezone">
          <Select id="timezone" name="timezone" defaultValue={family.timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ").replace("/", " / ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Town or city" htmlFor="locationName">
          <Input id="locationName" name="locationName" defaultValue={family.locationName ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" htmlFor="latitude" error={state?.errors?.latitude} hint="For weather">
            <Input id="latitude" name="latitude" inputMode="decimal" defaultValue={family.latitude ?? ""} placeholder="35.59" />
          </Field>
          <Field label="Longitude" htmlFor="longitude" error={state?.errors?.longitude}>
            <Input id="longitude" name="longitude" inputMode="decimal" defaultValue={family.longitude ?? ""} placeholder="-82.55" />
          </Field>
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
      </div>
    </form>
  );
}

export function ModulesForm({ enabled }: { enabled: string[] }) {
  const [state, action] = useActionState(updateEnabledModules, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <div className="grid gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
        {MODULES.map((m) => (
          <Toggle key={m} name={`module:${m}`} label={MODULE_META[m].label} description={MODULE_META[m].tagline} defaultChecked={enabled.includes(m)} />
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save areas</SubmitButton>
      </div>
    </form>
  );
}
