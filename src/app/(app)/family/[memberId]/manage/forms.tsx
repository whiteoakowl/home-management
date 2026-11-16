"use client";

import { useActionState } from "react";
import type { AccessLevel, Module } from "@/db/schema/_shared";
import { createMemberLogin, savePermissions, savePrivateFood } from "@/app/actions/family";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { PERIOD_OPTIONS, PermissionLegend, PermissionRows, type PersonalAreas } from "@/components/family/permissions-matrix";
import { saveHiddenAreas, saveParentAccess } from "@/app/actions/privacy";

export function PermissionsForm({
  member,
  modules,
  personal,
}: {
  member: { id: string; displayName: string; color: string; access: Partial<Record<Module, AccessLevel>> };
  modules: Module[];
  personal?: PersonalAreas;
}) {
  const [state, action] = useActionState(savePermissions, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <PermissionLegend />
      <PermissionRows memberId={member.id} access={member.access} modules={modules} personal={personal} />
      <p className="text-sm text-muted">
        Even with &ldquo;No access&rdquo;, {member.displayName} still sees chores and items assigned directly to them; to check them off and earn points, choose &ldquo;Use&rdquo; or higher. Anything set to &ldquo;No access&rdquo; disappears from {member.displayName}&apos;s menu, tabs and home screen. Period Tracker: {PERIOD_OPTIONS.filter((o) => o.value !== "hide").map((o) => `${o.label} = ${o.hint}`).join("; ")}. To let {member.displayName} make their own lists or calendar events, set Lists and Calendar to &ldquo;Add &amp; edit&rdquo;.
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
            <input type="hidden" name="area" value={a.key} />
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
