"use client";

import { useActionState } from "react";
import { Pencil } from "lucide-react";
import { deleteCategory, saveAutomationSettings, saveCategory, updateEnabledModules, updateFamily, uploadFamilyImage } from "@/app/actions/family";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import { ImageField, TextField } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { ColorPicker } from "@/components/family/member-form";
import { Field, FormMessage, Input, Select, SubmitButton, Toggle } from "@/components/ui/form";
import { MODULES } from "@/db/schema/_shared";
import { memberColor } from "@/lib/colors";
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

export function FamilyPhotoForm({ currentUrl }: { currentUrl: string | null }) {
  return (
    <ActionForm action={uploadFamilyImage} submitLabel="Save photo" resetOnSuccess={false} showSuccess>
      <ImageField label="Family photo or logo" currentUrl={currentUrl} />
    </ActionForm>
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

export function AutomationsForm({ automations, settings }: { automations: { key: string; label: string; description: string }[]; settings: { automations?: Record<string, boolean>; weekStartsOn?: 0 | 1 } }) {
  return (
    <ActionForm action={saveAutomationSettings} submitLabel="Save automations" resetOnSuccess={false} showSuccess>
      <div className="grid gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
        {automations.map((a) => (
          <Toggle key={a.key} name={`auto:${a.key}`} label={a.label} description={a.description} defaultChecked={settings.automations?.[a.key] !== false} />
        ))}
      </div>
      <Field label="Weeks start on" htmlFor="weekStartsOn" className="max-w-xs">
        <Select id="weekStartsOn" name="weekStartsOn" defaultValue={String(settings.weekStartsOn ?? 0)}>
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
        </Select>
      </Field>
    </ActionForm>
  );
}

export function CategoryManager({ domain, label, items }: { domain: string; label: string; items: { id: string; name: string; color: string | null }[] }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <FormModal title={`Add ${label.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}`} triggerLabel="Add" triggerVariant="ghost" triggerSize="sm" action={saveCategory} size="sm">
          <input type="hidden" name="domain" value={domain} />
          <TextField name="name" label="Name" required />
          <Field label="Colour (optional)">
            <ColorPicker defaultValue="" />
          </Field>
        </FormModal>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">None yet</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-0.5 rounded-full bg-sunken py-0.5 pr-0.5 pl-2.5 text-sm">
              {c.color && <span className="mr-1 size-2.5 rounded-full" style={{ background: memberColor(c.color).solid }} aria-hidden />}
              {c.name}
              <FormModal
                title="Edit category"
                action={saveCategory}
                size="sm"
                triggerAriaLabel={`Edit ${c.name}`}
                triggerContent={<Pencil className="mx-auto size-3" />}
                triggerClassName="size-6 rounded-full text-muted hover:bg-surface"
              >
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="domain" value={domain} />
                <TextField name="name" label="Name" required defaultValue={c.name} />
                <Field label="Colour">
                  <ColorPicker defaultValue={c.color ?? ""} />
                </Field>
              </FormModal>
              <DeleteButton action={deleteCategory} fields={{ id: c.id }} what={`“${c.name}”`} className="size-6" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

