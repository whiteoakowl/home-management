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
    console.error("Action failed:", e);
    const code = (e as { code?: unknown })?.code;
    const detail = String(err?.message ?? e).replace(/\s+/g, " ").slice(0, 220);
    return fail(`This couldn't be saved. ${typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? `Database error ${code}: ` : ""}${detail}`);
  }
}
