"use client";

import { useActionState, useState } from "react";
import { changeEmail, changePassword, resetMemberPassword, saveAppTheme, setMemberEmail } from "@/app/actions/account";
import { MEMBER_COLORS, MEMBER_COLOR_KEYS } from "@/lib/colors";
import { CustomColorSwatch, ThemePreview } from "@/components/ui/custom-color";
import { cn } from "@/lib/utils";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" key={state?.ok ? "done" : "form"}>
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <Field label="Current password" htmlFor="pw-current" error={state?.errors?.current}>
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="pw-new" error={state?.errors?.password} hint="At least 8 characters.">
          <Input id="pw-new" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={state?.errors?.confirm}>
          <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
      </div>
    </form>
  );
}

export function ChangeEmailForm({ email }: { email: string }) {
  const [state, action] = useActionState(changeEmail, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email (your sign-in)" htmlFor="em-email" error={state?.errors?.email}>
          <Input id="em-email" name="email" type="email" autoComplete="email" defaultValue={email} required />
        </Field>
        <Field label="Current password" htmlFor="em-current" error={state?.errors?.current} hint="To confirm it's you.">
          <Input id="em-current" name="current" type="password" autoComplete="current-password" required />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Change email</SubmitButton>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ memberId, name }: { memberId: string; name: string }) {
  const [state, action] = useActionState(resetMemberPassword, undefined);
  if (state?.ok) return <FormMessage tone="success" message={state.message} />;
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage message={state?.message} />
      <p className="text-[15px] text-muted">Forgot their password? Set a new temporary one for {name}. They&apos;ll be signed out and can change it from their Account page.</p>
      <input type="hidden" name="memberId" value={memberId} />
      <Field label="New temporary password" htmlFor="reset-pw" error={state?.errors?.password} hint="At least 8 characters.">
        <Input id="reset-pw" name="password" type="text" autoComplete="new-password" className="sm:max-w-sm" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Resetting…">Reset password</SubmitButton>
      </div>
    </form>
  );
}

export function MemberEmailForm({ memberId, name, email }: { memberId: string; name: string; email: string }) {
  const [state, action] = useActionState(setMemberEmail, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <input type="hidden" name="memberId" value={memberId} />
      <Field label={`${name}'s sign-in email`} htmlFor="member-email" error={state?.errors?.email}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="member-email" name="email" type="email" autoComplete="off" defaultValue={email} className="sm:flex-1" required />
          <SubmitButton pendingLabel="Saving…">Save email</SubmitButton>
        </div>
      </Field>
    </form>
  );
}

/** Pick an accent colour for my own app. */
export function AppThemeForm({ current }: { current: string | null }) {
  const [state, action] = useActionState(saveAppTheme, undefined);
  const [value, setValue] = useState(current ?? "");
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <input type="hidden" name="theme" value={value} />
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="App color theme">
        <button type="button" role="radio" aria-checked={value === ""} onClick={() => setValue("")} className={cn("inline-flex h-11 items-center gap-2 rounded-full border px-3 text-sm", value === "" ? "border-ink ring-2 ring-ink" : "border-line-strong")}>
          <span className="size-6 rounded-full bg-[#6a2d5e]" aria-hidden /> Family default
        </button>
        {MEMBER_COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            aria-label={MEMBER_COLORS[key].label}
            title={MEMBER_COLORS[key].label}
            onClick={() => setValue(key)}
            className={cn("size-11 rounded-full border border-black/10 ring-offset-2 ring-offset-surface", value === key ? "ring-2 ring-ink" : "hover:ring-2 hover:ring-line-strong")}
            style={{ backgroundColor: MEMBER_COLORS[key].solid }}
          />
        ))}
        <CustomColorSwatch value={value} onChange={setValue} size="lg" />
      </div>
      <ThemePreview value={value} />
      <p className="text-sm text-muted">Changes buttons, highlights and tabs in your app only. Your member color on the calendar and avatars (set by parents) stays the same.</p>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save colors</SubmitButton>
      </div>
    </form>
  );
}
