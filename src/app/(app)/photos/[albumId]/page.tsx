import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, Images, Trash2 } from "lucide-react";
import { db } from "@/db";
import { entityPhotos, photoAlbums } from "@/db/schema";
import { deleteAlbum, deleteAlbumPhotoItem } from "@/app/actions/hub";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { AddPhotosModal, AlbumModal } from "@/components/hub/forms";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer, listFamilyMembers } from "@/lib/dal";
import { formatLongDate } from "@/lib/dates";
import { fileUrl } from "@/lib/files";

export const metadata: Metadata = { title: "Album" };

export default async function AlbumPage({ params }: PageProps<"/photos/[albumId]">) {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const { albumId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(albumId)) notFound();
  const [album] = await db.select().from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.familyId, viewer.family.id)));
  if (!album) notFound();
  const [photos, members] = await Promise.all([
    db.select().from(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), eq(entityPhotos.entityId, album.id), eq(entityPhotos.familyId, viewer.family.id))).orderBy(desc(entityPhotos.createdAt)),
    listFamilyMembers(viewer.family.id),
  ]);
  const canUse = viewer.can("photos", "use");
  const canAll = viewer.can("photos", "edit");
  const canChangeAlbum = canUse && (album.createdByMemberId === viewer.member.id || canAll);
  const who = (id: string | null) => members.find((m) => m.id === id)?.displayName.split(" ")[0];

  return (
    <>
      <Link href="/photos" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft className="size-4" /> All albums
      </Link>
      <PageHeader
        eyebrow={album.eventDate ? formatLongDate(album.eventDate) : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
        title={album.title}
        description={album.description ?? undefined}
        actions={
          canUse ? (
            <>
              <AddPhotosModal albumId={album.id} />
              {canChangeAlbum && <AlbumModal item={{ id: album.id, title: album.title, description: album.description, eventDate: album.eventDate }} />}
            </>
          ) : undefined
        }
      />
      {photos.length === 0 ? (
        <Card>
          <EmptyState icon={<Images />} title="No photos yet" description="Add photos from your phone or computer. Everyone in the family can add to this album." action={canUse ? <AddPhotosModal albumId={album.id} /> : undefined} />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative overflow-hidden rounded-2xl bg-sunken">
              <a href={fileUrl(p.fileId)!} target="_blank" rel="noreferrer" className="block aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(p.fileId, true)!} alt={p.caption ?? `Photo in ${album.title}`} className="size-full object-cover" loading="lazy" />
              </a>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white">
                {p.caption && <p className="font-medium">{p.caption}</p>}
                {who(p.createdByMemberId) && <p className="opacity-80">by {who(p.createdByMemberId)}</p>}
              </div>
              {canUse && (p.createdByMemberId === viewer.member.id || canAll) && (
                <DeleteButton action={deleteAlbumPhotoItem} fields={{ id: p.id }} what="this photo" className="absolute top-1.5 right-1.5 bg-surface/90 opacity-0 group-hover:opacity-100 focus:opacity-100" />
              )}
            </li>
          ))}
        </ul>
      )}
      {canChangeAlbum && (
        <ActionButton action={deleteAlbum} fields={{ id: album.id }} confirm={`Delete the album "${album.title}" and all its photos? This can't be undone.`} className="mt-6 text-sm font-medium text-wine-600 hover:underline">
          <Trash2 className="size-4" /> Delete album
        </ActionButton>
      )}
    </>
  );
}
