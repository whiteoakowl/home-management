import { unstable_rethrow } from "next/navigation";
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
    unstable_rethrow(e); // redirect(), notFound() etc.
    // Anything else: log it (visible in the host's function logs) and say what happened.
    // In production people see a short reference instead of internal details (which stay in the logs).
    const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.error(`Action failed [ref ${ref}]:`, e);
    if (process.env.NODE_ENV === "production") return fail(`This couldn't be saved. Please try again; if it keeps happening, send us feedback and mention reference ${ref}.`);
    const code = (e as { code?: unknown })?.code;
    const detail = String(err?.message ?? e).replace(/\s+/g, " ").slice(0, 220);
    return fail(`This couldn't be saved. ${typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? `Database error ${code}: ` : ""}${detail}`);
  }
}
