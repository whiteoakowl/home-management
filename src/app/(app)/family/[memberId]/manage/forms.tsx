"use client";

import { useActionState } from "react";
import type { AccessLevel, Module } from "@/db/schema/_shared";
import { createMemberLogin, savePermissions, savePrivateFood } from "@/app/actions/family";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { PermissionLegend, PermissionRows } from "@/components/family/permissions-matrix";
import { saveHiddenAreas, saveParentAccess } from "@/app/actions/privacy";
import { saveOvulationSetting } from "@/app/actions/health";

export function PermissionsForm({
  member,
  modules,
}: {
  member: { id: string; displayName: string; color: string; access: Partial<Record<Module, AccessLevel>> };
  modules: Module[];
}) {
  const [state, action] = useActionState(savePermissions, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <PermissionLegend />
      <PermissionRows memberId={member.id} access={member.access} modules={modules} />
      <p className="text-sm text-muted">
        Even with &ldquo;No access&rdquo;, {member.displayName} still sees chores and items assigned directly to them. To let {member.displayName} make their own lists or calendar events, set Lists and Calendar to &ldquo;Add &amp; edit&rdquo;.
      </p>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save access</SubmitButton>
      </div>
    </form>
  );
}

export function LoginForm({ memberId, name }: { memberId: string; name: string }) {
  const [state, action] = useActionState(createMemberLogin, undefined);
  if (state?.ok) return <FormMessage tone="success" message={state.message} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-[15px] text-muted">{name} doesn&apos;t have a login yet. Create one so they can open their own home.</p>
      <input type="hidden" name="memberId" value={memberId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="login-email" error={state?.errors?.email}>
          <Input id="login-email" name="email" type="email" autoComplete="off" />
        </Field>
        <Field label="Temporary password" htmlFor="login-password" error={state?.errors?.password} hint="At least 8 characters.">
          <Input id="login-password" name="password" type="text" autoComplete="new-password" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Creating…">Create login</SubmitButton>
      </div>
    </form>
  );
}

export function PrivateFoodForm({ memberId, name, enabled, parentsCanSee }: { memberId: string; name: string; enabled: boolean; parentsCanSee: boolean }) {
  const [state, action] = useActionState(savePrivateFood, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-[15px] text-muted">
        A private food space gives {name} their own <strong>My Pantry</strong>, <strong>My Recipes</strong>, <strong>My Meal Plans</strong> and <strong>My Shopping List</strong>, kept apart from the family&apos;s.{" "}
        {parentsCanSee ? `${name} has chosen to let parents open it (read-only).` : `Nobody else can see it, parents included, unless ${name} chooses to share it with parents.`}
      </p>
      <Field label="Private food space" htmlFor="privateFood" className="max-w-xs">
        <Select id="privateFood" name="privateFood" defaultValue={enabled ? "enabled" : "disabled"}>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </Select>
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

/** Parent oversight for a minor: personal areas parents may view. The member sees this in their Privacy Center. */
export function ParentAccessForm({ memberId, name, areas, selected, hasLogin }: { memberId: string; name: string; areas: { key: string; label: string }[]; selected: string[]; hasLogin: boolean }) {
  const [state, action] = useActionState(saveParentAccess, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-[15px] text-muted">
        {hasLogin
          ? `${name}'s personal areas are private to them unless they share them. For a minor, you can turn on parent oversight for specific areas. ${name} will see exactly what's on in their Privacy Center.`
          : `${name} doesn't have a login, so parents manage their personal areas.`}
      </p>
      {hasLogin && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {areas.map((a) => (
              <label key={a.key} className="flex min-h-11 items-center gap-2 rounded-xl border border-line-strong px-3 text-sm">
                <input type="checkbox" name="areas" value={a.key} defaultChecked={selected.includes(a.key)} className="size-4 accent-[var(--color-primary-600)]" />
                {a.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}

/** Parents: simple period tracking (default) or ovulation estimates for a minor. */
export function OvulationForm({ memberId, name, on }: { memberId: string; name: string; on: boolean }) {
  const [state, action] = useActionState(saveOvulationSetting, undefined);
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-line pt-4">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-[15px] font-medium">Period Tracker</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-11 items-start gap-2 rounded-xl border border-line-strong p-3 text-sm">
          <input type="radio" name="showOvulation" value="false" defaultChecked={!on} className="mt-0.5 size-4 accent-[var(--color-primary-600)]" />
          <span>
            <span className="font-medium">Simple period tracking</span>
            <span className="block text-muted">Periods, symptoms and feelings only. No ovulation estimates.</span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-2 rounded-xl border border-line-strong p-3 text-sm">
          <input type="radio" name="showOvulation" value="true" defaultChecked={on} className="mt-0.5 size-4 accent-[var(--color-primary-600)]" />
          <span>
            <span className="font-medium">Include ovulation estimates</span>
            <span className="block text-muted">Also shows the estimated ovulation window.</span>
          </span>
        </label>
      </div>
      <p className="text-xs text-muted">This changes what {name}&apos;s tracker shows. It doesn&apos;t let you see {name}&apos;s records.</p>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

/** Parents: which personal areas appear on this person's profile. Turning one off keeps the records. */
export function HiddenAreasForm({ memberId, name, areas, hidden }: { memberId: string; name: string; areas: { key: string; label: string }[]; hidden: string[] }) {
  const [state, action] = useActionState(saveHiddenAreas, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-[15px] text-muted">Turn off areas {name} doesn&apos;t need. They disappear from {name}&apos;s menu, profile, calendar and reminders. Nothing is deleted.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {areas.map((a) => (
          <label key={a.key} className="flex min-h-11 items-center gap-2 rounded-xl border border-line-strong px-3 text-sm">
            <input type="checkbox" name="shown" value={a.key} defaultChecked={!hidden.includes(a.key)} className="size-4 accent-[var(--color-primary-600)]" />
            Show {a.label}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
