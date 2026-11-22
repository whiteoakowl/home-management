import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, Heart, Images, Lock, MessageCircle, Plane, Star, Trash2 } from "lucide-react";
import { db } from "@/db";
import { entityPhotos, photoAlbums } from "@/db/schema";
import { deleteAlbum, deleteAlbumPhotoItem } from "@/app/actions/hub";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { AddPhotosModal, AlbumModal } from "@/components/hub/forms";
import { MediaTile } from "@/components/memories/media";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatLongDate } from "@/lib/dates";
import { albumVisible, socialFor } from "@/lib/memories";
import { familyMembersFor } from "@/lib/names";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Album" };

const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default async function AlbumPage({ params }: PageProps<"/photos/[albumId]">) {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const { albumId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(albumId)) notFound();
  const [album] = await db.select().from(photoAlbums).where(and(eq(photoAlbums.id, albumId), albumVisible(viewer)));
  if (!album) notFound();
  const [photos, members, opts] = await Promise.all([
    db
      .select()
      .from(entityPhotos)
      .where(and(eq(entityPhotos.entityType, "album"), eq(entityPhotos.entityId, album.id), eq(entityPhotos.familyId, viewer.family.id)))
      .orderBy(desc(sql`coalesce(${entityPhotos.takenAt}, ${entityPhotos.createdAt})`)),
    familyMembersFor(viewer),
    memberOptions(viewer),
  ]);
  const social = await socialFor(viewer, "photo", photos.map((p) => p.id));
  const canUse = viewer.can("photos", "use");
  const canAll = viewer.can("photos", "edit");
  const canChangeAlbum = canUse && (album.createdByMemberId === viewer.member.id || canAll);
  const owner = members.find((m) => m.id === album.ownerMemberId);
  const months = new Map<string, typeof photos>();
  for (const p of photos) {
    const k = monthLabel(p.takenAt ?? p.createdAt);
    months.set(k, [...(months.get(k) ?? []), p]);
  }

  return (
    <>
      <Link href="/photos" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft className="size-4" /> All albums
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {album.eventDate ? formatLongDate(album.eventDate) : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
            {owner && <Badge tone="primary">{owner.displayName.split(" ")[0]}&apos;s album</Badge>}
            {album.private && (
              <Badge>
                <Lock className="size-3" /> Only me
              </Badge>
            )}
          </span>
        }
        title={album.title}
        description={album.description ?? undefined}
        actions={
          canUse ? (
            <>
              <AddPhotosModal albumId={album.id} />
              {canChangeAlbum && <AlbumModal members={opts} item={{ id: album.id, title: album.title, description: album.description, eventDate: album.eventDate, ownerMemberId: album.ownerMemberId, private: album.private }} />}
            </>
          ) : undefined
        }
      />
      {album.planId && (
        <Link href={`/plans/${album.planId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline">
          <Plane className="size-4" /> Open the trip
        </Link>
      )}
      {photos.length === 0 ? (
        <Card>
          <EmptyState icon={<Images />} title="No photos yet" description="Add photos from your phone or computer. Everyone who can see this album can add to it." action={canUse ? <AddPhotosModal albumId={album.id} /> : undefined} />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {[...months.entries()].map(([label, list]) => (
            <section key={label}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{label}</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((p) => {
                  const hearts = social.reactions.filter((r) => r.entityId === p.id).length;
                  const comments = social.comments.filter((c) => c.entityId === p.id).length;
                  const fav = social.favorites.has(p.id);
                  return (
                    <li key={p.id} className="group relative overflow-hidden rounded-2xl bg-sunken">
                      <Link href={`/photos/${album.id}/${p.id}`} className="block aspect-square" aria-label={p.caption ?? p.milestone ?? "Open photo"}>
                        <MediaTile fileId={p.fileId} mediaType={p.mediaType} alt={p.caption ?? `Photo in ${album.title}`} />
                      </Link>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white">
                        <span className="min-w-0">
                          {p.milestone && (
                            <span className="flex items-center gap-1 font-semibold">
                              <Star className="size-3 fill-[#f5c84c] text-[#f5c84c]" /> {p.milestone}
                            </span>
                          )}
                          {p.caption && <span className="block truncate">{p.caption}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {fav && <Heart className="size-3.5 fill-current" aria-label="Favorite" />}
                          {hearts > 0 && <span>❤️ {hearts}</span>}
                          {comments > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <MessageCircle className="size-3.5" /> {comments}
                            </span>
                          )}
                        </span>
                      </div>
                      {canUse && (p.createdByMemberId === viewer.member.id || canAll) && (
                        <DeleteButton action={deleteAlbumPhotoItem} fields={{ id: p.id }} what="this photo" className="absolute top-1.5 right-1.5 bg-surface/90 opacity-0 group-hover:opacity-100 focus:opacity-100" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {canChangeAlbum && (
        <ActionButton action={deleteAlbum} fields={{ id: album.id }} confirm={`Delete the album "${album.title}" and all its photos? This can't be undone.`} className="mt-6 text-sm font-medium text-wine-600 hover:underline">
          <Trash2 className="size-4" /> Delete album
        </ActionButton>
      )}
    </>
  );
}
