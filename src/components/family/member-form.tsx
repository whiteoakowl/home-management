"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createMember, updateMember } from "@/app/actions/family";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { MEMBER_COLORS, MEMBER_COLOR_KEYS } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function ColorPicker({ name = "color", defaultValue }: { name?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      <input type="hidden" name={name} value={value} />
      {MEMBER_COLOR_KEYS.map((key) => {
        const c = MEMBER_COLORS[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            title={c.label}
            onClick={() => setValue(key)}
            className={cn(
              "size-9 rounded-full ring-offset-2 ring-offset-surface transition-shadow",
              selected ? "ring-2 ring-ink" : "hover:ring-2 hover:ring-line-strong",
            )}
            style={{ backgroundColor: c.solid }}
          />
        );
      })}
    </div>
  );
}

/** Add a new family member. Used in onboarding and on the Family page. */
export function AddMemberForm({
  defaultRole = "member",
  lockRole,
  onDone,
  submitLabel = "Add to family",
}: {
  defaultRole?: "parent" | "member";
  lockRole?: boolean;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(createMember, undefined);
  const [withLogin, setWithLogin] = useState(defaultRole === "parent");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="displayName" error={state?.errors?.displayName}>
          <Input id="displayName" name="displayName" placeholder="e.g. Emma" required />
        </Field>
        {lockRole ? (
          <input type="hidden" name="role" value={defaultRole} />
        ) : (
          <Field label="Role" htmlFor="role" hint="Parents can manage everything.">
            <Select id="role" name="role" defaultValue={defaultRole}>
              <option value="member">Family member</option>
              <option value="parent">Parent</option>
            </Select>
          </Field>
        )}
        <Field label="Birthday (optional)" htmlFor="birthday">
          <Input id="birthday" name="birthday" type="date" />
        </Field>
      </div>
      <Field label="Colour" hint="Used on their calendar events, chores and avatar. We'll pick one if you don't." error={state?.errors?.color}>
        <ColorPicker />
      </Field>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-sunken/60 p-3">
        <input
          type="checkbox"
          checked={withLogin}
          onChange={(e) => setWithLogin(e.target.checked)}
          className="size-5 accent-primary-600"
        />
        <span className="flex flex-col">
          <span className="text-[15px] font-medium">Give them their own login</span>
          <span className="text-sm text-muted">Optional. Young children can be added without one.</span>
        </span>
      </label>
      {withLogin && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={state?.errors?.email}>
            <Input id="email" name="email" type="email" autoComplete="off" />
          </Field>
          <Field label="Temporary password" htmlFor="password" hint="At least 8 characters." error={state?.errors?.password}>
            <Input id="password" name="password" type="text" autoComplete="new-password" />
          </Field>
        </div>
      )}
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Adding…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function EditMemberForm({
  member,
  isOwner,
}: {
  member: { id: string; displayName: string; role: "parent" | "member"; color: string; birthday: string | null };
  isOwner: boolean;
}) {
  const [state, action] = useActionState(updateMember, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <input type="hidden" name="memberId" value={member.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="displayName" error={state?.errors?.displayName}>
          <Input id="displayName" name="displayName" defaultValue={member.displayName} required />
        </Field>
        <Field label="Role" htmlFor="role" error={state?.errors?.role} hint={isOwner ? "The family owner is always a parent." : undefined}>
          <Select id="role" name="role" defaultValue={member.role} disabled={isOwner}>
            <option value="member">Family member</option>
            <option value="parent">Parent</option>
          </Select>
          {isOwner && <input type="hidden" name="role" value="parent" />}
        </Field>
        <Field label="Birthday" htmlFor="birthday">
          <Input id="birthday" name="birthday" type="date" defaultValue={member.birthday ?? ""} />
        </Field>
      </div>
      <Field label="Colour">
        <ColorPicker defaultValue={member.color} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
