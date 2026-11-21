import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Lock, MapPin, Star, Trash2 } from "lucide-react";
import { db } from "@/db";
import { memories, memoryMedia } from "@/db/schema";
import { deleteMemory, removeMemoryMedia } from "@/app/actions/memories";
import { ActionButton } from "@/components/forms/inline";
import { MediaTile, SocialBar, downloadHref } from "@/components/memories/media";
import { MemoryModal } from "@/components/memories/memory-form";
import { Card } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatLongDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { memoryVisible, socialFor } from "@/lib/memories";
import { familyMembersFor } from "@/lib/names";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Memory" };

export default async function MemoryPage({ params }: PageProps<"/memories/[id]">) {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [m] = await db.select().from(memories).where(and(eq(memories.id, id), memoryVisible(viewer)));
  if (!m) notFound();
  const [media, people, opts, social] = await Promise.all([
    db.select().from(memoryMedia).where(eq(memoryMedia.memoryId, m.id)).orderBy(memoryMedia.sort, memoryMedia.createdAt),
    familyMembersFor(viewer),
    memberOptions(viewer),
    socialFor(viewer, "memory", [m.id]),
  ]);
  const canChange = viewer.can("photos", "use") && (m.createdByMemberId === viewer.member.id || viewer.can("photos", "edit"));
  const who = people.filter((p) => m.memberIds.includes(p.id));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/memories" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft className="size-4" /> Memories
      </Link>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{formatLongDate(m.date)}</p>
          <h1 className="flex flex-wrap items-center gap-2 text-[28px] leading-tight font-semibold sm:text-[32px]">
            {m.kind === "milestone" && <Star className="size-6 fill-[#f5c84c] text-[#d9a514]" aria-label="Milestone" />}
            {m.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
            {m.place && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {m.place}
              </span>
            )}
            {m.visibility === "private" && (
              <Badge>
                <Lock className="size-3" /> Only me
              </Badge>
            )}
          </p>
        </div>
        {canChange && (
          <span className="flex shrink-0">
            <MemoryModal members={opts} today={todayIn(viewer.family.timezone)} item={{ id: m.id, title: m.title, body: m.body, date: m.date, milestone: m.kind === "milestone", memberIds: m.memberIds, place: m.place, private: m.visibility === "private" }} />
            <ActionButton action={deleteMemory} fields={{ id: m.id }} confirm={`Delete "${m.title}" and its photos and videos? This can't be undone.`} label="Delete memory" className="size-9 rounded-full text-muted hover:bg-sunken hover:text-wine-700">
              <Trash2 className="size-4" />
            </ActionButton>
          </span>
        )}
      </header>

      {who.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {who.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-sunken py-1 pr-3 pl-1 text-sm">
              <Avatar name={p.displayName} color={p.color} photoUrl={fileUrl(p.avatarFileId, true)} size="sm" /> {p.displayName.split(" ")[0]}
            </span>
          ))}
        </div>
      )}
      {m.body && <p className="text-[16px] leading-relaxed whitespace-pre-line">{m.body}</p>}

      {media.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {media.map((x) => (
            <li key={x.id} className="group relative overflow-hidden rounded-2xl bg-sunken">
              {x.mediaType === "video" ? (
                <div className="aspect-video">
                  <MediaTile fileId={x.fileId} mediaType="video" alt={m.title} controls />
                </div>
              ) : (
                <a href={fileUrl(x.fileId)!} target="_blank" rel="noreferrer" className="block aspect-[4/3]">
                  <MediaTile fileId={x.fileId} mediaType="photo" alt={x.caption ?? m.title} controls />
                </a>
              )}
              <span className="absolute top-2 right-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <a href={downloadHref(x.fileId)} download className="rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium">
                  Download
                </a>
                {canChange && (
                  <ActionButton action={removeMemoryMedia} fields={{ id: x.id }} confirm="Remove this from the memory?" label="Remove" className="rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium text-wine-700">
                    Remove
                  </ActionButton>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <SocialBar type="memory" id={m.id} social={social} me={viewer.member.id} isParent={viewer.isParent} />
      </Card>
    </div>
  );
}
