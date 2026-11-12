"use client";

import { useActionState } from "react";
import type { AccessLevel, Module } from "@/db/schema/_shared";
import { createMemberLogin, savePermissions } from "@/app/actions/family";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { PermissionRows } from "@/components/family/permissions-matrix";

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
      <PermissionRows memberId={member.id} access={member.access} modules={modules} />
      <p className="text-sm text-muted">
        Even with &ldquo;Hidden&rdquo;, {member.displayName} still sees chores and items assigned directly to them.
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
