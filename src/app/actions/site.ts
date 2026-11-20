"use server";

import { db } from "@/db";
import { feedback } from "@/db/schema";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { f } from "@/lib/records";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const TOPICS = ["question", "sales", "support", "press", "other"];

/**
 * The public website's contact form. Messages land in Admin → Feedback.
 * A hidden "website" field catches simple spam bots.
 */
export async function sendContact(_: ActionState, fd: FormData): Promise<ActionState> {
  if (f.str(fd, "website")) return ok("Thanks! We'll be in touch soon.");
  const name = f.str(fd, "name")?.slice(0, 120);
  const email = f.str(fd, "email")?.toLowerCase().slice(0, 200);
  const message = f.str(fd, "message");
  if (!name) return fail("Please tell us your name.", "name");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Please enter a valid email so we can reply.", "email");
  if (!message || message.length < 5) return fail("Please write a short message.", "message");
  if (message.length > 5000) return fail("Please keep it under 5,000 characters.", "message");
  if (!(await rateLimit(`contact:${await clientIp()}`, 5, 3600))) return fail("You've sent several messages already. Please try again a little later.");
  const topic = TOPICS.includes(f.str(fd, "topic") ?? "") ? f.str(fd, "topic")! : "question";
  await db.insert(feedback).values({ kind: "contact", message, contactEmail: email, page: "/contact", meta: { name, topic } });
  return ok("Thanks for reaching out! We usually reply within one business day.");
}
