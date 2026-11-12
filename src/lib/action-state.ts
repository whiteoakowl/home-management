import type { z } from "zod";

/** Uniform return shape for Server Actions used with useActionState. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
} | undefined;

export function fieldErrors(error: z.ZodError): ActionState {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (errors[key] ??= []).push(issue.message);
  }
  return { ok: false, errors };
}

export const ok = (message?: string): ActionState => ({ ok: true, message });
export const fail = (message: string, field?: string): ActionState =>
  field ? { ok: false, errors: { [field]: [message] } } : { ok: false, message };

/** Errors that are safe to show to the user (checked via the `userFacing` flag). */
export class UserFacingError extends Error {
  readonly userFacing = true;
  constructor(message: string, public field?: string) {
    super(message);
  }
}

/**
 * Wrap an action body: turns authorization/upload/user-facing errors into a
 * friendly ActionState instead of an error page. Redirects pass through.
 */
export async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    const err = e as { userFacing?: boolean; message: string; field?: string };
    if (err && err.userFacing) return fail(err.message, err.field);
    throw e;
  }
}
