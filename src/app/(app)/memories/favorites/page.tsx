import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Heart, Star } from "lucide-react";
import { db } from "@/db";
import { entityPhotos, mediaFavorites, memories, memoryMedia, photoAlbums } from "@/db/schema";
import { MediaTile } from "@/components/memories/media";
import { MemoriesTabs } from "@/components/memories/tabs";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { albumVisible, memoryVisible } from "@/lib/memories";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const favs = await db.select().from(mediaFavorites).where(eq(mediaFavorites.memberId, viewer.member.id)).orderBy(desc(mediaFavorites.createdAt));
  const photoIds = favs.filter((f) => f.entityType === "photo").map((f) => f.entityId);
  const memoryIds = favs.filter((f) => f.entityType === "memory").map((f) => f.entityId);
  const [photos, mems] = await Promise.all([
    photoIds.length
      ? db
          .select({ id: entityPhotos.id, fileId: entityPhotos.fileId, mediaType: entityPhotos.mediaType, caption: entityPhotos.caption, albumId: entityPhotos.entityId })
          .from(entityPhotos)
          .innerJoin(photoAlbums, eq(photoAlbums.id, entityPhotos.entityId))
          .where(and(inArray(entityPhotos.id, photoIds), albumVisible(viewer)))
      : Promise.resolve([]),
    memoryIds.length ? db.select().from(memories).where(and(inArray(memories.id, memoryIds), memoryVisible(viewer))) : Promise.resolve([]),
  ]);
  const covers = mems.length ? await db.select().from(memoryMedia).where(inArray(memoryMedia.memoryId, mems.map((m) => m.id))) : [];
  const order = (id: string) => favs.findIndex((f) => f.entityId === id);
  const items = [
    ...photos.map((p) => ({ key: `p:${p.id}`, at: order(p.id), href: `/photos/${p.albumId}`, fileId: p.fileId, mediaType: p.mediaType, title: p.caption ?? "", milestone: false })),
    ...mems.map((m) => {
      const c = covers.find((x) => x.memoryId === m.id);
      return { key: `m:${m.id}`, at: order(m.id), href: `/memories/${m.id}`, fileId: c?.fileId ?? null, mediaType: c?.mediaType ?? "photo", title: m.title, milestone: m.kind === "milestone" };
    }),
  ].sort((a, b) => a.at - b.at);

  return (
    <>
      <PageHeader eyebrow="Memories" title="My favorites" description="Photos, videos and memories you've hearted. Only you see this list." />
      <MemoriesTabs active="favorites" />
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Heart />} title="No favorites yet" description="Tap the heart on any photo, video or memory to keep it here." />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="group block overflow-hidden rounded-2xl border border-line bg-surface">
                <span className="flex aspect-square items-center justify-center bg-sunken">
                  {it.fileId ? <MediaTile fileId={it.fileId} mediaType={it.mediaType} alt={it.title} /> : <Star className="size-8 text-muted" />}
                </span>
                {it.title && (
                  <span className="flex items-center gap-1 truncate px-3 py-2 text-sm font-medium">
                    {it.milestone && <Star className="size-3.5 shrink-0 fill-[#f5c84c] text-[#d9a514]" />} {it.title}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
