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
