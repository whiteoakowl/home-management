import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { MessagesSquare } from "lucide-react";
import { db } from "@/db";
import { familyMessages } from "@/db/schema";
import { deleteMessage } from "@/app/actions/hub";
import { DeleteButton } from "@/components/forms/inline";
import { ChatComposer, ChatLive } from "@/components/hub/forms";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer, listFamilyMembers } from "@/lib/dal";
import { formatTime } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { markRead } from "@/lib/hub";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Family Chat" };

const dayLabel = (d: Date, tz: string) => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer.can("messages")) notFound();
  const tz = viewer.family.timezone;
  const [rows, members] = await Promise.all([
    db.select().from(familyMessages).where(and(eq(familyMessages.familyId, viewer.family.id))).orderBy(desc(familyMessages.createdAt)).limit(200),
    listFamilyMembers(viewer.family.id),
  ]);
  await markRead(viewer.family.id, viewer.member.id);
  const messages = rows.reverse();
  const who = (id: string | null) => members.find((m) => m.id === id);
  const canSend = viewer.can("messages", "use");

  const days = messages.map((m) => dayLabel(m.createdAt, tz));
  return (
    <>
      <PageHeader eyebrow="Today" title="Family Chat" description="One conversation for the whole family. Share plans, photos and quick updates." />
      <ChatLive latest={messages.at(-1)?.id ?? ""} />
      <Card className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <EmptyState icon={<MessagesSquare />} title="Say hello" description="Messages here go to everyone in the family. Send the first one below." />
        ) : (
          <ol className="flex max-h-[62dvh] flex-col gap-3 overflow-y-auto pr-1" aria-label="Messages">
            {messages.map((m, i) => {
              const day = days[i]!;
              const showDay = day !== days[i - 1];
              const author = who(m.memberId);
              const mine = m.memberId === viewer.member.id;
              const img = fileUrl(m.fileId);
              return (
                <li key={m.id} className="flex flex-col gap-3">
                  {showDay && <p className="self-center rounded-full bg-sunken px-3 py-0.5 text-xs font-medium text-muted">{day}</p>}
                  <div className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}>
                    {!mine && <Avatar name={author?.displayName ?? "?"} color={author?.color ?? "stone"} photoUrl={fileUrl(author?.avatarFileId, true)} size="sm" />}
                    <div className={cn("flex max-w-[80%] flex-col gap-1", mine && "items-end")}>
                      {!mine && <span className="px-1 text-xs font-medium text-muted">{author?.displayName.split(" ")[0] ?? "Former member"}</span>}
                      <div className={cn("rounded-2xl px-3.5 py-2 text-[15px] leading-snug", mine ? "rounded-br-md bg-primary-600 text-white" : "rounded-bl-md bg-sunken")}>
                        {img && (
                          <a href={img} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="Shared photo" className="mb-1 max-h-72 rounded-xl object-cover" loading="lazy" />
                          </a>
                        )}
                        {m.body && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>}
                      </div>
                      <span className="px-1 text-[11px] text-muted">{formatTime(m.createdAt, tz)}</span>
                    </div>
                    {(mine || viewer.isParent) && <DeleteButton action={deleteMessage} fields={{ id: m.id }} what="this message" className="opacity-0 group-hover:opacity-100 focus:opacity-100" />}
                  </div>
                </li>
              );
            })}
            <li id="chat-end" aria-hidden />
          </ol>
        )}
        {canSend ? <ChatComposer /> : <p className="text-sm text-muted">You can read the family chat. Ask a parent if you&apos;d like to send messages.</p>}
      </Card>
    </>
  );
}
