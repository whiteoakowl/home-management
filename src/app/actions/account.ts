"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { hashPassword, revokeSessions, verifyPassword } from "@/lib/auth/session";
import { getFamilyMember, getViewer, requireParent } from "@/lib/dal";
import { logActivity } from "@/lib/family";

const NewPassword = z.string().min(8, "Use at least 8 characters.").max(200, "That's too long.");

const ChangePassword = z
  .object({ current: z.string().min(1, "Enter your current password."), password: NewPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The new passwords don't match." })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Choose a different password from your current one." });

/** Change your own password. Other devices are signed out; this one stays signed in. */
export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const parsed = ChangePassword.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const [u] = await db.select().from(users).where(eq(users.id, viewer.user.id));
  if (!u || !(await verifyPassword(parsed.data.current, u.passwordHash))) return { ok: false, errors: { current: ["That isn't your current password."] } };
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, u.id));
  await revokeSessions(u.id, { keepCurrent: true });
  return { ok: true, message: "Password changed. Any other devices have been signed out." };
}

const ChangeEmail = z.object({ email: z.email("Please enter a valid email.").trim().toLowerCase(), current: z.string().min(1, "Enter your current password.") });

export async function changeEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const parsed = ChangeEmail.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const [u] = await db.select().from(users).where(eq(users.id, viewer.user.id));
  if (!u || !(await verifyPassword(parsed.data.current, u.passwordHash))) return { ok: false, errors: { current: ["That isn't your current password."] } };
  const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, parsed.data.email), ne(users.id, u.id)));
  if (taken) return { ok: false, errors: { email: ["That email is already used by another account."] } };
  await db.update(users).set({ email: parsed.data.email }).where(eq(users.id, u.id));
  revalidatePath("/account");
  return { ok: true, message: `Email changed. Sign in with ${parsed.data.email} from now on.` };
}

const ResetPassword = z.object({ memberId: z.uuid(), password: NewPassword });

/**
 * A parent sets a new temporary password for a family member (forgotten
 * password). The account owner can reset anyone; other parents can reset
 * members who aren't parents. The member is signed out everywhere.
 */
export async function resetMemberPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await requireParent();
  const parsed = ResetPassword.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const target = await getFamilyMember(viewer, parsed.data.memberId);
  if (!target?.userId) return { ok: false, message: "That family member doesn't have a login." };
  if (target.id === viewer.member.id) return { ok: false, message: "Change your own password from your Account page." };
  const isOwner = viewer.family.ownerMemberId === viewer.member.id;
  if (target.role === "parent" && !isOwner) return { ok: false, message: "Only the family's owner can reset another parent's password." };
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, target.userId));
  await revokeSessions(target.userId);
  await logActivity(db, viewer.family.id, viewer.member.id, "member.password_reset", `reset ${target.displayName}'s password`);
  return { ok: true, message: `Password reset. Share the new password with ${target.displayName}; they've been signed out on their devices.` };
}
