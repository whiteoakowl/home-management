"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { feedback, reviews } from "@/db/schema";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { getViewer } from "@/lib/dal";
import { f } from "@/lib/records";

const KINDS = ["idea", "problem", "praise", "question", "other"];

/** Anyone in a family can send feedback; platform admins read it in Admin → Feedback. */
export async function sendFeedback(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const message = f.str(fd, "message");
  if (!message || message.length < 3) return fail("Tell us a little about it.", "message");
  if (message.length > 5000) return fail("Please keep it under 5,000 characters.", "message");
  const kind = KINDS.includes(f.str(fd, "kind") ?? "") ? f.str(fd, "kind")! : "idea";
  const rating = f.int(fd, "rating");
  const contact = fd.get("contactOk") === "on" ? viewer.user.email : null;
  await db.insert(feedback).values({
    familyId: viewer.family.id,
    memberId: viewer.member.id,
    kind,
    rating: rating && rating >= 1 && rating <= 5 ? rating : null,
    message,
    page: f.str(fd, "page")?.slice(0, 200) ?? null,
    contactEmail: contact,
  });
  return ok("Thank you! Your feedback was sent.");
}

/**
 * Write (or update) your review. It shows on the public Reviews page once a
 * platform admin approves it; editing sends it back for approval.
 */
export async function saveReview(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  const rating = f.int(fd, "rating");
  if (!rating || rating < 1 || rating > 5) return fail("Choose a star rating.", "rating");
  const body = f.str(fd, "body");
  if (!body || body.length < 10) return fail("Tell other families a little more (at least a sentence).", "body");
  if (body.length > 2000) return fail("Please keep it under 2,000 characters.", "body");
  const displayName = f.str(fd, "displayName")?.slice(0, 80);
  if (!displayName) return fail("How should we show your name?", "displayName");
  const values = { rating, body, displayName, title: f.str(fd, "title")?.slice(0, 120) ?? null, status: "pending", updatedAt: new Date() };
  const [mine] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.memberId, viewer.member.id), eq(reviews.familyId, viewer.family.id)));
  if (mine) await db.update(reviews).set(values).where(eq(reviews.id, mine.id));
  else await db.insert(reviews).values({ ...values, familyId: viewer.family.id, memberId: viewer.member.id });
  revalidatePath("/feedback");
  revalidatePath("/admin/reviews");
  return ok("Thank you! Your review will appear on our website once it's approved.");
}
