import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Images } from "lucide-react";
import { db } from "@/db";
import { entityPhotos, photoAlbums } from "@/db/schema";
import { AlbumModal } from "@/components/hub/forms";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { fileUrl } from "@/lib/files";

export const metadata: Metadata = { title: "Photo Albums" };

export default async function PhotosPage() {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const canUse = viewer.can("photos", "use");
  const albums = await db.select().from(photoAlbums).where(eq(photoAlbums.familyId, viewer.family.id)).orderBy(desc(photoAlbums.updatedAt));
  const ids = albums.map((a) => a.id);
  const [counts, covers] = ids.length
    ? await Promise.all([
        db.select({ id: entityPhotos.entityId, n: count() }).from(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), inArray(entityPhotos.entityId, ids))).groupBy(entityPhotos.entityId),
        db.selectDistinctOn([entityPhotos.entityId], { id: entityPhotos.entityId, fileId: entityPhotos.fileId }).from(entityPhotos).where(and(eq(entityPhotos.entityType, "album"), inArray(entityPhotos.entityId, ids))).orderBy(entityPhotos.entityId, desc(entityPhotos.createdAt)),
      ])
    : [[], []];

  return (
    <>
      <PageHeader eyebrow="Household" title="Photo Albums" description="Shared albums everyone in the family can add to: trips, holidays, recitals, game days and everyday moments." actions={canUse ? <AlbumModal /> : undefined} />
      {albums.length === 0 ? (
        <Card>
          <EmptyState icon={<Images />} title="Make your first album" description="Create an album, then everyone can add photos from their phone." example="Beach trip 2026 · 48 photos" action={canUse ? <AlbumModal /> : undefined} />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {albums.map((a) => {
            const cover = covers.find((c) => c.id === a.id);
            const n = counts.find((c) => c.id === a.id)?.n ?? 0;
            return (
              <li key={a.id}>
                <Link href={`/photos/${a.id}`} className="group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
                  <div className="flex aspect-square items-center justify-center bg-sunken">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(cover.fileId, true)!} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                      <Images className="size-10 text-muted" aria-hidden />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-sm text-muted">
                      {n} photo{n === 1 ? "" : "s"}
                      {a.eventDate ? ` · ${formatShortDate(a.eventDate)}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
