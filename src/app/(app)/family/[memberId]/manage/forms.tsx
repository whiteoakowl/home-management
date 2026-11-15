"use client";

import { useActionState } from "react";
import type { AccessLevel, Module } from "@/db/schema/_shared";
import { createMemberLogin, savePermissions, savePrivateFood } from "@/app/actions/family";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { PermissionLegend, PermissionRows } from "@/components/family/permissions-matrix";

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
        {parentsCanSee ? "Parents can open it read-only (Settings → Family Pantry privacy)." : "Nobody else can see it, parents included, unless the family turns that on in Settings."}
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
