"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, requestPasswordReset, resetPassword, signup } from "@/app/actions/auth";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="mb-2 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Welcome home</h1>
        <p className="text-sm text-muted">Sign in to your family&apos;s home.</p>
      </div>
      {notice && !state && (
        <p role="status" className="rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-800">
          {notice}
        </p>
      )}
      <FormMessage message={state?.message} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Link href="/forgot-password" className="-mt-2 self-end text-sm font-medium text-primary-600 hover:underline">
        Forgot password?
      </Link>
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
      <p className="text-center text-xs text-muted">
        By creating an account you agree to our{" "}
        <a href="/terms" target="_blank" className="underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy-policy" target="_blank" className="underline">
          Privacy Policy
        </a>
        .
      </p>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="mb-2 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
        <p className="text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      {state?.ok ? (
        <p role="status" className="rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-800">
          {state.message}
        </p>
      ) : (
        <>
          <FormMessage message={state?.message} />
          <Field label="Email" htmlFor="email" error={state?.errors?.email}>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <SubmitButton className="mt-2" pendingLabel="Sending…">
            Email me a reset link
          </SubmitButton>
        </>
      )}
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="mb-2 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted">At least 8 characters, with a letter and a number. You&apos;ll be signed out on your other devices.</p>
      </div>
      <FormMessage message={state?.message} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Type it again" htmlFor="confirm" error={state?.errors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="mt-2" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
