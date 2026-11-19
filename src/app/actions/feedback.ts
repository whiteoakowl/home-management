"use server";

import { db } from "@/db";
import { feedback } from "@/db/schema";
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
