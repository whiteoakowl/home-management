"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { familyBilling, feedback, platformSettings, reviews } from "@/db/schema";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { isPlatformAdmin } from "@/lib/billing";
import { getViewer } from "@/lib/dal";
import { f } from "@/lib/records";

export async function requirePlatformAdmin() {
  const viewer = await getViewer();
  if (!isPlatformAdmin(viewer.user.email)) notFound();
  return viewer;
}

/** Brand, prices, trial length and the billing switch for the whole service. */
export async function savePlatformSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const brandName = f.str(fd, "brandName");
  const monthly = f.num(fd, "monthly");
  const yearly = f.num(fd, "yearly");
  const trialDays = f.int(fd, "trialDays");
  if (!brandName || brandName.length > 60) return fail("Enter the product name (up to 60 characters).", "brandName");
  if (monthly === null || monthly < 0.5 || monthly > 1000) return fail("Enter a monthly price between $0.50 and $1,000.", "monthly");
  if (yearly === null || yearly < 0.5 || yearly > 10000) return fail("Enter a yearly price between $0.50 and $10,000.", "yearly");
  if (trialDays === null || trialDays < 0 || trialDays > 90) return fail("Trial length must be 0–90 days.", "trialDays");
  const values = {
    brandName,
    monthlyPriceCents: Math.round(monthly * 100),
    yearlyPriceCents: Math.round(yearly * 100),
    trialDays,
    billingEnabled: f.bool(fd, "billingEnabled"),
    updatedAt: new Date(),
  };
  await db.insert(platformSettings).values({ id: "default", ...values }).onConflictDoUpdate({ target: platformSettings.id, set: values });
  revalidatePath("/", "layout");
  return ok("Saved. New prices apply to new subscriptions; existing subscribers keep their current price.");
}

/** Make a family free (or take that back). */
export async function setComplimentary(fd: FormData) {
  await requirePlatformAdmin();
  const familyId = String(fd.get("familyId"));
  const on = fd.get("on") === "1";
  const note = f.str(fd, "note");
  if (on) {
    await db
      .insert(familyBilling)
      .values({ familyId, status: "complimentary", compNote: note ?? "Made free by admin" })
      .onConflictDoUpdate({ target: familyBilling.familyId, set: { status: "complimentary", compNote: note ?? "Made free by admin", updatedAt: new Date() } });
  } else {
    // Back to paying: they'll be asked to choose a plan (a live Stripe subscription re-syncs via webhook).
    await db.update(familyBilling).set({ status: "none", compNote: null, updatedAt: new Date() }).where(eq(familyBilling.familyId, familyId));
  }
  revalidatePath("/admin", "layout");
}

export async function setFeedbackStatus(fd: FormData) {
  await requirePlatformAdmin();
  const status = String(fd.get("status"));
  if (!["new", "read", "done"].includes(status)) return;
  await db.update(feedback).set({ status, adminNote: f.str(fd, "adminNote"), updatedAt: new Date() }).where(eq(feedback.id, String(fd.get("id"))));
  revalidatePath("/admin/feedback");
}

/** Approve, hide or feature a customer review for the public Reviews page. */
export async function setReviewStatus(fd: FormData) {
  await requirePlatformAdmin();
  const id = String(fd.get("id") ?? "");
  const op = String(fd.get("op"));
  const set =
    op === "approve" ? { status: "approved" } : op === "hide" ? { status: "hidden", featured: false } : op === "feature" ? { status: "approved", featured: true } : op === "unfeature" ? { featured: false } : null;
  if (!set || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.update(reviews).set({ ...set, updatedAt: new Date() }).where(eq(reviews.id, id));
  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
  revalidatePath("/welcome");
}
