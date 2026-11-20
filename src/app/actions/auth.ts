"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { rememberFamilyOfUser } from "@/lib/auth/device-family";
import { createSession, destroySession, hashPassword, readSessionUser, revokeSessions, verifyPassword } from "@/lib/auth/session";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import { sendVerification } from "@/lib/auth/verify-email";
import { getBrand } from "@/lib/billing";
import { buttonEmail, emailConfigured, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { clientIp, rateLimit, TOO_MANY } from "@/lib/rate-limit";
import { safePath } from "@/lib/safe-redirect";

/** Compared against when the email is unknown, so a wrong email takes as long as a wrong password. */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

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
  // At most 5 new accounts per hour from one address.
  if (!(await rateLimit(`signup:${await clientIp()}`, 5, 3600))) return { ok: false, message: TOO_MANY };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).catch(databaseDown);
  if (!existing) return DB_DOWN;
  if (existing.length) return { ok: false, errors: { email: ["An account with this email already exists."] } };

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  await createSession(user!.id);
  await sendVerification({ id: user!.id, email, name }).catch((e) => console.error("Verification email failed:", e));
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
  // Slow down password guessing: per account and per address.
  const ip = await clientIp();
  if (!(await rateLimit(`login:ip:${ip}`, 30, 900)) || !(await rateLimit(`login:email:${email}`, 10, 900))) return { ok: false, message: TOO_MANY };

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1).catch(databaseDown);
  if (!rows) return DB_DOWN;
  const [user] = rows;
  // Same message whether the email or password is wrong.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) {
    return { ok: false, message: "That email and password don't match." };
  }
  await createSession(user.id);
  await rememberFamilyOfUser(user.id);
  // Only allow same-site relative redirects.
  redirect(safePath(next));
}

/** Sign out and go to the website's home page. */
export async function logout() {
  await destroySession();
  redirect("/");
}

// ─── Password reset & email verification ─────────────────────────────────────

const SENT = "If an account uses that email, we've sent a link to reset the password. It works for 1 hour. (Check your spam folder too.)";

/** "Forgot password?": always answers the same, so it never reveals which emails have accounts. */
export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.email("Please enter a valid email.").trim().toLowerCase() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { email } = parsed.data;
  if (!(await rateLimit(`reset-ip:${await clientIp()}`, 10, 3600)) || !(await rateLimit(`reset:${email}`, 3, 3600))) return { ok: true, message: SENT };
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const token = await issueToken(user.id, "reset");
    const brand = await getBrand();
    const url = `${await siteUrl()}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: `Reset your ${brand} password`,
      ...buttonEmail({ brand, heading: "Reset your password", body: `We got a request to reset the password for ${user.email}. Choose a new one with the button below.`, button: "Choose a new password", url, footer: "This link works for 1 hour and only once. If you didn't ask for this, you can ignore this email; your password stays the same." }),
    });
  }
  return { ok: true, message: emailConfigured() ? SENT : `${SENT} If no email arrives, a parent in your family can set a new password for you from Family → your name → Manage.` };
}

const NewPassword = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "Use at least 8 characters.").max(200).regex(/[a-zA-Z]/, "Include at least one letter.").regex(/[0-9]/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

/** Set a new password from an emailed link; signs out every device. */
export async function resetPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = NewPassword.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  if (!(await rateLimit(`reset-use:${await clientIp()}`, 20, 3600))) return { ok: false, message: TOO_MANY };
  const row = await consumeToken(parsed.data.token, "reset");
  if (!row) return { ok: false, message: "This link has expired or was already used. Ask for a new one." };
  // Using the link proves the person owns the email.
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
  await revokeSessions(row.userId);
  redirect("/login?reset=1");
}

/** Send the verification email again (signed-in account holder). */
export async function resendVerification(): Promise<ActionState> {
  const user = await readSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!(await rateLimit(`verify-send:${user.id}`, 4, 3600))) return { ok: false, message: TOO_MANY };
  await sendVerification(user);
  return { ok: true, message: `We've sent a new link to ${user.email}.` };
}
