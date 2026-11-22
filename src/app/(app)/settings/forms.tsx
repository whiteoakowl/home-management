"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { deleteCategory, saveAutomationSettings, saveCategory, saveKidNames, updateEnabledModules, updateFamily, uploadFamilyImage } from "@/app/actions/family";
import { saveFamilyFaiths } from "@/app/actions/faith";
import { Button } from "@/components/ui/button";
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

export function ModulesForm({ enabled, readOnly = false }: { enabled: string[]; readOnly?: boolean }) {
  const [state, action] = useActionState(updateEnabledModules, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <div className="grid gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
        {MODULES.map((m) => (
          <Toggle key={m} name={`module:${m}`} label={MODULE_META[m].label} description={MODULE_META[m].tagline} defaultChecked={enabled.includes(m)} disabled={readOnly} />
        ))}
      </div>
      {!readOnly && (
        <div className="mt-2 flex justify-end">
          <SubmitButton pendingLabel="Saving…">Save sections</SubmitButton>
        </div>
      )}
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

/** What the kids call each parent ("Dad", "Mom"); shown to kids everywhere instead of the real name. */
export function KidNamesForm({ parents }: { parents: { id: string; name: string; kidName: string; color: string; editable: boolean }[] }) {
  return (
    <ActionForm action={saveKidNames} submitLabel="Save names" showSuccess resetOnSuccess={false}>
      <ul className="flex flex-col gap-3">
        {parents.map((p) => (
          <li key={p.id} className="grid items-center gap-2 sm:grid-cols-[10rem_1fr]">
            <span className="flex items-center gap-2 font-medium">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: memberColor(p.color).solid }} aria-hidden />
              {p.name}
            </span>
            <TextField
              name={`kidName:${p.id}`}
              label={`Kids see ${p.name.split(" ")[0]} as`}
              defaultValue={p.kidName}
              placeholder={p.name.split(" ")[0]}
              maxLength={30}
              disabled={!p.editable}
              hint={p.editable ? undefined : "Only they (or the account holder) can change this."}
            />
          </li>
        ))}
      </ul>
    </ActionForm>
  );
}

type FaithOption = { key: string; label: string; emoji: string; blurb: string };
type FaithMember = { id: string; name: string; color: string; role: string };

/** Religions the family uses, and which members get each one (a checkbox per person). */
export function FamilyFaithsForm({ options, enabled, members, access }: { options: FaithOption[]; enabled: string[]; members: FaithMember[]; access: Record<string, string[]> }) {
  const [state, action, pending] = useActionState(saveFamilyFaiths, undefined);
  const [, start] = useTransition();
  const [on, setOn] = useState<string[]>(enabled);
  // faith -> member ids
  const [who, setWho] = useState<Record<string, string[]>>(() => Object.fromEntries(options.map((o) => [o.key, members.filter((m) => (access[m.id] ?? []).includes(o.key)).map((m) => m.id)])));
  const toggleFaith = (k: string) => {
    setOn((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
    // Turning a religion on for the first time gives it to everyone; untick people who don't use it.
    if (!on.includes(k) && !(who[k] ?? []).length) setWho((w) => ({ ...w, [k]: members.map((m) => m.id) }));
  };
  const toggleMember = (k: string, id: string) => setWho((w) => ({ ...w, [k]: (w[k] ?? []).includes(id) ? w[k]!.filter((x) => x !== id) : [...(w[k] ?? []), id] }));
  return (
    // Submitted by hand (not <form action>) so React doesn't reset the checkboxes after saving.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(() => action(fd));
      }}
      className="flex flex-col gap-3"
    >
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <ul className="flex flex-col gap-3">
        {options.map((o) => {
          const active = on.includes(o.key);
          return (
            <li key={o.key} className={`rounded-2xl border p-4 ${active ? "border-primary-300 bg-primary-50/50" : "border-line"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" name="faith" value={o.key} checked={active} onChange={() => toggleFaith(o.key)} className="mt-0.5 size-5 shrink-0 accent-primary-600" />
                <span className="flex flex-col">
                  <span className="font-semibold">
                    <span aria-hidden>{o.emoji}</span> {o.label}
                  </span>
                  <span className="text-sm text-muted">{o.blurb}</span>
                </span>
              </label>
              {active && (
                <fieldset className="mt-3 border-t border-line pt-3 sm:pl-8">
                  <legend className="sr-only">Who gets {o.label}</legend>
                  <p className="mb-2 text-sm font-medium">
                    Who gets this tab{" "}
                    <button type="button" className="ml-1 text-primary-700 hover:underline" onClick={() => setWho((w) => ({ ...w, [o.key]: (w[o.key] ?? []).length === members.length ? [] : members.map((m) => m.id) }))}>
                      {(who[o.key] ?? []).length === members.length ? "Clear" : "Everyone"}
                    </button>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => {
                      const has = (who[o.key] ?? []).includes(m.id);
                      return (
                        <label key={m.id} className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${has ? "border-primary-400 bg-surface font-medium" : "border-line text-muted"}`}>
                          <input type="checkbox" name={`access:${o.key}`} value={m.id} checked={has} onChange={() => toggleMember(o.key, m.id)} className="size-4 accent-primary-600" />
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: memberColor(m.color).solid }} aria-hidden />
                          {m.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save religions"}
        </Button>
      </div>
    </form>
  );
}
