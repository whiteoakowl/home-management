"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth/session";
import { fieldErrors, type ActionState } from "@/lib/action-state";

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(80),
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .regex(/[a-zA-Z]/, "Include at least one letter.")
    .regex(/[0-9]/, "Include at least one number."),
});

/** The first query on a fresh deployment fails here when no database is set up; say so plainly. */
const DB_DOWN: ActionState = {
  ok: false,
  message: "The app can't reach its database right now. If this is a new deployment, a database still needs to be added (see README, Deploying).",
};
function databaseDown(e: unknown): null {
  console.error("Database unavailable during sign-in:", e);
  return null;
}

export async function signup(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { name, email, password } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).catch(databaseDown);
  if (!existing) return DB_DOWN;
  if (existing.length) return { ok: false, errors: { email: ["An account with this email already exists."] } };

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  await createSession(user!.id);
  redirect("/onboarding");
}

const LoginSchema = z.object({
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  password: z.string().min(1, "Please enter your password."),
  next: z.string().optional(),
});

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { email, password, next } = parsed.data;

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1).catch(databaseDown);
  if (!rows) return DB_DOWN;
  const [user] = rows;
  // Same message whether the email or password is wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, message: "That email and password don't match." };
  }
  await createSession(user.id);
  // Only allow same-site relative redirects.
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
