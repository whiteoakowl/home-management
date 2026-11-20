import "server-only";
import { after } from "next/server";
import { CHANNELS, canSeeChannel, type Channel } from "./hub-shared";
import { viewersOf } from "./automation";
import { sendPush } from "./push";
import { db } from "@/db";
import { familyMembers } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/** Push a new Family Chat message to everyone who can see that chat (not the sender). Quiet hours apply. */
export function pushChat(familyId: string, sender: { id: string; displayName: string; kidName: string | null; role: string }, channel: Channel, text: string) {
  const run = async () => {
    const ids = (await viewersOf(familyId, "messages")).filter((id) => id !== sender.id);
    if (!ids.length) return;
    const people = await db.select({ id: familyMembers.id, role: familyMembers.role }).from(familyMembers).where(and(eq(familyMembers.familyId, familyId), inArray(familyMembers.id, ids)));
    const to = people.filter((p) => canSeeChannel(p.role === "parent", channel));
    const where = channel === "all" ? "Family Chat" : `${CHANNELS.find((c) => c.key === channel)?.label ?? "Family"} chat`;
    const first = sender.displayName.split(" ")[0]!;
    // Kids see a parent by the name they use for them ("Dad"), like everywhere else in the app.
    const kidsName = sender.role === "parent" && sender.kidName?.trim() ? sender.kidName.trim() : first;
    const msg = (name: string) => ({ title: `${name} · ${where}`, body: text, href: `/messages?channel=${channel}`, tag: `chat-${channel}` });
    await Promise.all([
      sendPush(to.filter((p) => p.role === "parent").map((p) => p.id), "chat", msg(first)),
      sendPush(to.filter((p) => p.role !== "parent").map((p) => p.id), "chat", msg(kidsName)),
    ]);
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
