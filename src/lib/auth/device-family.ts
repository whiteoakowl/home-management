import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { families, familyMembers } from "@/db/schema";

/**
 * Remembers which family last signed in on this device, so the sign-in
 * page can offer the app under that family's name (a phone names an
 * installed app after the page it was installed from). Holds only a family
 * id: it grants no access.
 */
const COOKIE = "fb_device_family";

export async function rememberDeviceFamily(familyId: string) {
  (await cookies()).set(COOKIE, familyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
}

/** Remember the family of a user who just signed in (if they have one yet). */
export async function rememberFamilyOfUser(userId: string) {
  const [m] = await db.select({ familyId: familyMembers.familyId }).from(familyMembers).where(and(eq(familyMembers.userId, userId), eq(familyMembers.isActive, true))).limit(1);
  if (m) await rememberDeviceFamily(m.familyId);
}

export async function deviceFamily() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [f] = await db.select({ id: families.id, name: families.name }).from(families).where(eq(families.id, id));
  return f ?? null;
}
