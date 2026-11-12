"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="mb-2 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Welcome home</h1>
        <p className="text-sm text-muted">Sign in to Vanderbilt Family.</p>
      </div>
      <FormMessage message={state?.message} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="mt-2" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary-600 hover:underline">
          Create your family
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="mb-2 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted">You&apos;ll set up your family in the next step.</p>
      </div>
      <FormMessage message={state?.message} />
      <Field label="Your name" htmlFor="name" error={state?.errors?.name}>
        <Input id="name" name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters, with a letter and a number."
        error={state?.errors?.password}
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="mt-2" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
